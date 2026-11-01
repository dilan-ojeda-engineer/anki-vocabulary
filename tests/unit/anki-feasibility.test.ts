import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { packageReceiptFixture } from '../../src/shared/fixtures/workflow';
import { parseAnkiOptions } from '../../src/experiments/anki-options';
import {
  approvalRecordSchema,
  type DeliveryReceipt,
} from '../../src/shared/contracts';
import {
  AnkiConnectClient,
  AnkiConnectError,
  validateEndpoint,
} from '../../src/integrations/anki/client';
import {
  assertPairing,
  deliverProbeNote,
  intentSchema,
} from '../../src/integrations/anki/reconcile';
import { toContractId } from '../../src/integrations/anki/schemas';

const intent = intentSchema.parse({
  pairing: {
    collectionPairId: '0a2b6dc4-0331-4b63-8066-e007a2ddcbe3',
    profile: 'Disposable',
    session: 'test-session',
    mode: 'direct',
  },
  destination: {
    collectionPairId: '0a2b6dc4-0331-4b63-8066-e007a2ddcbe3',
    mode: 'direct',
    deckId: 2,
    deckName: 'AV004::Test',
  },
  draft: {
    sourceNoteId: 'av004-test',
    revision: 1,
    profile: { id: 'anki-feasibility', version: '1' },
  },
  modelId: '10',
  modelName: 'AV004_abcdef',
});
const approval = approvalRecordSchema.parse({
  draft: intent.draft,
  approvedAt: '2026-11-01T12:00:00Z',
});
const fields = {
  Front: 'Test front',
  Back: 'Test back',
  Audio: '[sound:test.wav]',
};

function server(
  options: {
    duplicates?: boolean;
    missingDeck?: boolean;
    wrongSession?: boolean;
    wrongSource?: boolean;
    failCreateAfterWrite?: boolean;
    wrongDeck?: boolean;
  } = {},
) {
  let note: null | {
    id: string;
    noteType: { id: string; name: string };
    fields: Record<string, string>;
    tags: string[];
    cardIds: string[];
    modifiedAt: string;
  } = null;
  let lostResponse = options.failCreateAfterWrite ?? false;
  const methods: string[] = [];
  const fetcher: typeof fetch = async (_url, init) => {
    const request = z
      .object({
        id: z.number(),
        method: z.string(),
        params: z.record(z.string(), z.unknown()),
      })
      .parse(JSON.parse(String(init?.body)) as unknown);
    methods.push(request.method);
    let result: unknown;
    switch (request.method) {
      case 'collection.get':
        result = {
          profile: 'Disposable',
          session: options.wrongSession ? 'changed' : 'test-session',
          scheduler: 'sm2',
        };
        break;
      case 'decks.list':
        result = options.missingDeck
          ? []
          : [{ id: '2', name: 'AV004::Test', kind: 'normal', presetId: '1' }];
        break;
      case 'notes.search':
        result = {
          ids: options.duplicates ? ['20', '21'] : note ? ['20'] : [],
          nextCursor: null,
        };
        break;
      case 'notes.create': {
        const value = z
          .record(z.string(), z.string())
          .parse(request.params.fields);
        note = {
          id: '20',
          noteType: { id: '10', name: 'AV004_abcdef' },
          fields: value,
          tags: ['av004-disposable'],
          cardIds: ['30'],
          modifiedAt: '2026-11-01T12:00:00Z',
        };
        if (lostResponse) {
          lostResponse = false;
          throw new Error('Simulated response loss AFTER external create');
        }
        result = { noteId: '20', cardIds: ['30'] };
        break;
      }
      case 'notes.get':
        result =
          options.wrongSource && note
            ? { ...note, fields: { ...note.fields, AvSourceId: 'unrelated' } }
            : note;
        break;
      case 'notes.update': {
        if (!note) throw new Error('No fake note');
        const patch = z
          .object({ fields: z.record(z.string(), z.string()) })
          .parse(request.params.patch);
        note = { ...note, fields: { ...note.fields, ...patch.fields } };
        result = note;
        break;
      }
      case 'cards.get':
        result = {
          id: '30',
          noteId: '20',
          deck: { id: options.wrongDeck ? '3' : '2', name: 'AV004::Test' },
          homeDeck: null,
          templateIndex: 0,
          flags: 0,
          modifiedAt: '2026-11-01T12:00:00Z',
          scheduling: {
            type: 'review',
            queue: 'review',
            due: { kind: 'day', day: 10 },
            intervalDays: 2,
            learningIntervalSeconds: null,
            remainingSteps: 0,
            repetitions: 3,
            lapses: 0,
            sm2EasePermille: 2500,
            fsrsMemory: null,
            desiredRetention: null,
          },
        };
        break;
      default:
        throw new Error('Unexpected fake API request');
    }
    return Response.json({ jsonrpc: '2.0', id: request.id, result });
  };
  return {
    client: new AnkiConnectClient('http://127.0.0.1:18765/api/v1', fetcher),
    methods,
    get note() {
      return note;
    },
    dropNote() {
      note = null;
    },
  };
}

describe('AnkiConnect v1 transport', () => {
  it('validates CLI resume identifiers and revision metadata before locks or external writes', () => {
    expect(parseAnkiOptions([]).run).toBe(false);
    expect(
      parseAnkiOptions([
        '--resume',
        '0a2b6dc4-0331-4b63-8066-e007a2ddcbe3',
        '--disposable-profile',
        'User 1',
      ]).resume,
    ).toBe('0a2b6dc4-0331-4b63-8066-e007a2ddcbe3');
    for (const args of [
      ['--resume', 'nope', '--disposable-profile', 'User 1'],
      ['--preview', '../outside', '--disposable-profile', 'User 1'],
      ['--run', '--disposable-profile', 'User 1', '--addon-revision', 'nope'],
      ['--run'],
      [
        '--run',
        '--resume',
        '0a2b6dc4-0331-4b63-8066-e007a2ddcbe3',
        '--disposable-profile',
        'User 1',
      ],
    ])
      expect(() => parseAnkiOptions(args)).toThrow();
  });
  it('restricts the endpoint to an explicit loopback API without redirects or embedded credentials', () => {
    expect(validateEndpoint('http://127.0.0.1:18765/api/v1')).toContain(
      '127.0.0.1',
    );
    for (const endpoint of [
      'https://example.com/api/v1',
      'http://127.0.0.1.example.com/api/v1',
      'http://user:secret@127.0.0.1/api/v1',
      'http://127.0.0.1/api/v1?key=secret',
      'http://127.0.0.1/',
    ])
      expect(() => validateEndpoint(endpoint)).toThrow();
  });

  it('rejects mismatched IDs, malformed envelopes, and wrong result types', async () => {
    for (const raw of [
      { jsonrpc: '2.0', id: 99, result: 1 },
      { id: 1, result: 1 },
      { jsonrpc: '2.0', id: 1, result: 'wrong' },
    ]) {
      const client = new AnkiConnectClient(
        'http://127.0.0.1:18765/api/v1',
        async () => Response.json(raw),
      );
      await expect(client.call('test', {}, z.number())).rejects.toMatchObject({
        code: 'PROTOCOL',
      });
    }
  });

  it('does not echo server errors or credentials', async () => {
    const client = new AnkiConnectClient(
      'http://127.0.0.1:18765/api/v1',
      async () =>
        Response.json({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: 1005,
            message: 'private-value',
            data: { type: 'staleSession' },
          },
        }),
    );
    await expect(client.call('test', {}, z.number())).rejects.toThrow(
      'staleSession',
    );
    const other = new AnkiConnectClient(
      'http://127.0.0.1:18765/api/v1',
      async () => {
        throw new Error('secret transport details');
      },
    );
    await expect(
      other.call('notes.create', {}, z.number(), true),
    ).rejects.toMatchObject({ code: 'TRANSPORT', mayHaveCommitted: true });
  });

  it('never rounds string IDs into the numeric AV-003 contract', () => {
    expect(toContractId('1700000000001')).toBe(1700000000001);
    expect(() => toContractId('9007199254740992')).toThrow();
    expect(() => toContractId('01')).toThrow();
  });

  it('rejects missing results even when the caller accepts unknown result data', async () => {
    const client = new AnkiConnectClient(
      'http://127.0.0.1:18765/api/v1',
      async () => Response.json({ jsonrpc: '2.0', id: 1 }),
    );
    await expect(client.call('test', {}, z.unknown())).rejects.toMatchObject({
      code: 'PROTOCOL',
    });
  });

  it('accepts the native navigation acknowledgment and retains handles on poll failure', async () => {
    const success = new AnkiConnectClient(
      'http://127.0.0.1:18765/api/v1',
      async () =>
        Response.json({
          jsonrpc: '2.0',
          id: 1,
          result: {
            operationId: 'operation-1',
            method: 'application.navigate',
            session: 'test-session',
            state: 'succeeded',
            result: { changed: true },
          },
        }),
    );
    const handle = {
      operationId: 'operation-1',
      method: 'application.navigate',
      session: 'test-session',
    };
    await expect(
      success.wait(
        handle,
        'test-session',
        z.strictObject({ changed: z.boolean() }),
      ),
    ).resolves.toEqual({ changed: true });
    const failure = new AnkiConnectClient(
      'http://127.0.0.1:18765/api/v1',
      async () => {
        throw new Error('private transport details');
      },
    );
    await expect(
      failure.wait(handle, 'test-session', z.number()),
    ).rejects.toMatchObject({
      code: 'TRANSPORT',
      operationId: 'operation-1',
      mayHaveCommitted: true,
    });
  });

  it('binds operation polling to the original session and method', async () => {
    const client = new AnkiConnectClient(
      'http://127.0.0.1:18765/api/v1',
      async () =>
        Response.json({
          jsonrpc: '2.0',
          id: 1,
          result: {
            operationId: 'operation-1',
            method: 'media.store',
            session: 'other',
            state: 'succeeded',
            result: 1,
          },
        }),
    );
    await expect(
      client.wait(
        {
          operationId: 'operation-1',
          method: 'media.store',
          session: 'test-session',
        },
        'test-session',
        z.number(),
      ),
    ).rejects.toMatchObject({ code: 'PROTOCOL' });
  });
});

describe('Anki source-identity reconciliation (fake transport)', () => {
  it('reconciles a fake server committed write after response loss before retrying', async () => {
    const fake = server({ failCreateAfterWrite: true });
    let receipt: DeliveryReceipt | undefined;
    const save = async (value: DeliveryReceipt) => {
      receipt = value;
    };
    await expect(
      deliverProbeNote(
        fake.client,
        intent,
        approval,
        fields,
        ['audio-test'],
        save,
      ),
    ).rejects.toBeInstanceOf(AnkiConnectError);
    expect(fake.note?.id).toBe('20');
    expect(receipt).toBeUndefined();
    const recovered = await deliverProbeNote(
      fake.client,
      intent,
      approval,
      fields,
      ['audio-test'],
      save,
    );
    expect(recovered.disposition).toBe('reconciled');
    expect(
      fake.methods.filter((method) => method === 'notes.create'),
    ).toHaveLength(1);
    const repeated = await deliverProbeNote(
      fake.client,
      intent,
      approval,
      fields,
      ['audio-test'],
      save,
      recovered.receipt,
    );
    expect(repeated.disposition).toBe('unchanged');
    const revised = { ...intent, draft: { ...intent.draft, revision: 2 } };
    const revisedApproval = { ...approval, draft: revised.draft };
    const updated = await deliverProbeNote(
      fake.client,
      revised,
      revisedApproval,
      { ...fields, Back: 'Updated' },
      ['audio-test'],
      save,
      recovered.receipt,
    );
    expect(updated.disposition).toBe('updated');
    expect(
      updated.receipt.mode === 'direct' &&
        updated.receipt.status === 'complete' &&
        updated.receipt.externalNoteId,
    ).toBe(20);
    expect(
      fake.methods.filter((method) => method === 'notes.create'),
    ).toHaveLength(1);
  });

  it('recovers a lost local receipt after successful external creation', async () => {
    const fake = server();
    await expect(
      deliverProbeNote(
        fake.client,
        intent,
        approval,
        fields,
        ['audio-test'],
        async () => {
          throw new Error('receipt write interrupted');
        },
      ),
    ).rejects.toThrow('receipt write interrupted');
    const recovered = await deliverProbeNote(
      fake.client,
      intent,
      approval,
      fields,
      ['audio-test'],
      async () => {},
    );
    expect(recovered.disposition).toBe('reconciled');
    expect(
      fake.methods.filter((method) => method === 'notes.create'),
    ).toHaveLength(1);
  });

  it('blocks stale approval before making any request', async () => {
    const fake = server();
    await expect(
      deliverProbeNote(
        fake.client,
        { ...intent, draft: { ...intent.draft, revision: 2 } },
        approval,
        fields,
        ['audio-test'],
        async () => {},
      ),
    ).rejects.toThrow('Exact-revision approval');
    expect(fake.methods).toHaveLength(0);
  });

  it.each([
    ['duplicate identities', { duplicates: true }],
    ['missing destination', { missingDeck: true }],
    ['changed collection session', { wrongSession: true }],
  ])('blocks %s before creation', async (_name, options) => {
    const fake = server(options);
    await expect(
      deliverProbeNote(
        fake.client,
        intent,
        approval,
        fields,
        ['audio-test'],
        async () => {},
      ),
    ).rejects.toThrow();
    expect(fake.methods).not.toContain('notes.create');
    expect(fake.methods).not.toContain('notes.update');
  });

  it('does not trust a search hit with another hidden identity', async () => {
    const fake = server({ wrongSource: true });
    await deliverProbeNote(
      fake.client,
      intent,
      approval,
      fields,
      ['audio-test'],
      async () => {},
    );
    await expect(
      deliverProbeNote(
        fake.client,
        intent,
        approval,
        fields,
        ['audio-test'],
        async () => {},
      ),
    ).rejects.toThrow('could not be reconciled');
    expect(
      fake.methods.filter((method) => method === 'notes.create'),
    ).toHaveLength(1);
  });

  it('rejects changed profiles and package-mode pairing reuse', () => {
    expect(() =>
      assertPairing(
        { profile: 'Different', session: 'test-session', scheduler: 'sm2' },
        intent.pairing,
      ),
    ).toThrow();
    expect(() =>
      intentSchema.parse({
        ...intent,
        pairing: { ...intent.pairing, mode: 'package' },
      }),
    ).toThrow();
  });

  it('rejects hidden-field overrides and cross-mode receipts before any request', async () => {
    const fake = server();
    const overridden = { ...fields, AvSourceId: 'unrelated' };
    await expect(
      deliverProbeNote(
        fake.client,
        intent,
        approval,
        overridden,
        ['audio-test'],
        async () => {},
      ),
    ).rejects.toThrow();
    await expect(
      deliverProbeNote(
        fake.client,
        intent,
        approval,
        fields,
        ['audio-test'],
        async () => {},
        packageReceiptFixture,
      ),
    ).rejects.toThrow('delivery-mode');
    expect(fake.methods).toHaveLength(0);
  });

  it('does not recreate a missing previously delivered note or move an existing card', async () => {
    const fake = server();
    const created = await deliverProbeNote(
      fake.client,
      intent,
      approval,
      fields,
      ['audio-test'],
      async () => {},
    );
    fake.dropNote();
    await expect(
      deliverProbeNote(
        fake.client,
        intent,
        approval,
        fields,
        ['audio-test'],
        async () => {},
        created.receipt,
      ),
    ).rejects.toThrow('creation is blocked');
    expect(
      fake.methods.filter((method) => method === 'notes.create'),
    ).toHaveLength(1);
    const moved = server({ wrongDeck: true });
    await deliverProbeNote(
      moved.client,
      intent,
      approval,
      fields,
      ['audio-test'],
      async () => {},
    );
    await expect(
      deliverProbeNote(
        moved.client,
        intent,
        approval,
        fields,
        ['audio-test'],
        async () => {},
      ),
    ).rejects.toThrow('no silent move');
    expect(moved.methods).not.toContain('notes.update');
  });
});
