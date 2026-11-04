import { createHash } from 'node:crypto';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it } from 'vitest';
import { z } from 'zod';
import { AnkiConnectClient } from '../../src/integrations/anki/client';
import { DeliveryService } from '../../src/server/delivery-service';
import { AudioService } from '../../src/server/audio-service';
import { WorkspaceStore } from '../../src/server/workspace';
import { previewImport } from '../../src/server/card-import';
import { englishCoachFieldsFixture } from '../../src/shared/fixtures/workflow';
import {
  ankiFieldNames,
  ankiTemplate,
  ankiFields,
} from '../../src/server/anki-template';
import { createApiHandler } from '../../src/server/http';

const folders: string[] = [];
afterEach(async () => {
  await Promise.all(
    folders.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
type FakeNote = {
  id: string;
  noteType: { id: string; name: string };
  fields: Record<string, string>;
  tags: string[];
  cardIds: string[];
  modifiedAt: string;
};
function fakeAnki() {
  const state = {
    session: 'session-one',
    profile: 'Disposable',
    lost: 'none' as 'none' | 'before' | 'after',
    duplicates: false,
    unavailable: false,
    disconnectDuringMedia: false,
    model: null as null | Record<string, unknown>,
    notes: [] as FakeNote[],
    media: new Map<string, string>(),
    operations: new Map<string, unknown>(),
    calls: [] as string[],
  };
  const fetcher: typeof fetch = async (_url, init) => {
    if (state.unavailable) throw new Error('fake-disconnected');
    const request = z
      .object({
        id: z.number(),
        method: z.string(),
        params: z.record(z.string(), z.unknown()),
      })
      .parse(JSON.parse(String(init?.body)));
    const { method, params } = request;
    state.calls.push(method);
    let result: unknown;
    const reply = (value: unknown) =>
      new Response(
        JSON.stringify({ jsonrpc: '2.0', id: request.id, result: value }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    const failure = (type: string) =>
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32000, message: 'Fake failure', data: { type } },
        }),
      );
    if (params.session && params.session !== state.session)
      return failure('collectionChanged');
    switch (method) {
      case 'api.describe':
        result = {
          apiMajor: 1,
          ankiVersion: 'fake',
          methods: [
            'collection.get',
            'decks.list',
            'noteTypes.list',
            'noteTypes.get',
            'noteTypes.create',
            'notes.search',
            'notes.get',
            'notes.create',
            'cards.get',
            'media.get',
            'media.store',
            'operations.get',
          ].map((name) => ({ name, available: true, reason: null })),
        };
        break;
      case 'collection.get':
        result = {
          profile: state.profile,
          session: state.session,
          scheduler: 'fsrs',
        };
        break;
      case 'decks.list':
        result = [
          { id: '2', name: 'English::Test', kind: 'normal', presetId: '1' },
          { id: '3', name: 'Other', kind: 'normal', presetId: '1' },
        ];
        break;
      case 'noteTypes.list':
        result = state.model ? [{ id: '10', name: state.model.name }] : [];
        break;
      case 'noteTypes.get':
        result = state.model;
        break;
      case 'noteTypes.create':
        state.model = {
          ...params,
          id: '10',
          templates: (params.templates as object[]).map((template) => ({
            ...template,
            deck: null,
          })),
        };
        delete state.model.session;
        result = state.model;
        break;
      case 'notes.search': {
        const source = String(params.query).slice('AvSourceId:'.length);
        const found = state.notes.filter(
          (note) => note.fields.AvSourceId === source,
        );
        result = {
          ids:
            state.duplicates && found[0]
              ? [found[0].id, found[0].id]
              : found.map((note) => note.id),
          nextCursor: null,
        };
        break;
      }
      case 'notes.get':
        result = state.notes.find((note) => note.id === params.id);
        break;
      case 'notes.create': {
        const lost = state.lost;
        state.lost = 'none';
        if (lost === 'before') throw new Error('response lost before commit');
        const id = String(100 + state.notes.length);
        const cardId = String(200 + state.notes.length);
        const note: FakeNote = {
          id,
          noteType: { id: '10', name: String(state.model?.name) },
          fields: z.record(z.string(), z.string()).parse(params.fields),
          tags: [],
          cardIds: [cardId],
          modifiedAt: '2026-11-03T00:00:00Z',
        };
        state.notes.push(note);
        if (lost === 'after') throw new Error('response lost after commit');
        result = { noteId: id, cardIds: [cardId] };
        break;
      }
      case 'cards.get': {
        const note = state.notes.find((note) =>
          note.cardIds.includes(String(params.id)),
        )!;
        result = {
          id: params.id,
          noteId: note.id,
          deck: { id: '2', name: 'English::Test' },
          homeDeck: null,
          templateIndex: 0,
          flags: 0,
          modifiedAt: 'now',
          scheduling: {
            type: 'new',
            queue: 'new',
            due: { kind: 'position', position: 1 },
            intervalDays: 0,
            learningIntervalSeconds: null,
            remainingSteps: 0,
            repetitions: 0,
            lapses: 0,
            sm2EasePermille: 2500,
            fsrsMemory: null,
            desiredRetention: null,
          },
        };
        break;
      }
      case 'media.get':
        if (!state.media.has(String(params.filename)))
          return failure('notFound');
        result = {
          filename: params.filename,
          data: state.media.get(String(params.filename)),
        };
        break;
      case 'media.store': {
        const filename = String(params.filename);
        if (state.media.has(filename)) return failure('conflict');
        const data = z.object({ data: z.string() }).parse(params.source).data;
        state.media.set(filename, data);
        if (state.disconnectDuringMedia) {
          state.disconnectDuringMedia = false;
          state.unavailable = true;
        }
        const operationId = `op${state.operations.size}`;
        state.operations.set(operationId, {
          filename,
          status: 'stored',
          sha256: createHash('sha256')
            .update(Buffer.from(data, 'base64'))
            .digest('hex'),
        });
        result = { operationId, method: 'media.store', session: state.session };
        break;
      }
      case 'operations.get':
        result = {
          operationId: params.operationId,
          method: 'media.store',
          session: state.session,
          state: 'succeeded',
          result: state.operations.get(String(params.operationId)),
        };
        break;
      default:
        throw new Error(`Unexpected fake method ${method}`);
    }
    return reply(result);
  };
  return {
    state,
    client: new AnkiConnectClient('http://127.0.0.1:8765/api/v1', fetcher),
  };
}
function wave() {
  const b = Buffer.alloc(46);
  b.write('RIFF');
  b.writeUInt32LE(38, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(2, 40);
  return b;
}
async function setup(count = 1) {
  const directory = await mkdtemp(join(tmpdir(), 'anki-delivery-'));
  folders.push(directory);
  const workspace = new WorkspaceStore(directory);
  const cards = (
    await workspace.add(
      previewImport({
        format: 'json',
        text: JSON.stringify(
          Array.from({ length: count }, (_, i) => ({
            ...englishCoachFieldsFixture,
            target: i ? 'uneasy' : 'awkward',
            examples: [
              ...englishCoachFieldsFixture.examples,
              'The timing felt awkward.',
            ],
          })),
        ),
      }),
      Array.from({ length: count }, (_, i) => i + 1),
    )
  ).cards;
  const audio = new AudioService(
    join(directory, 'audio'),
    workspace,
    {
      configuration: {
        providerId: 'fake',
        modelId: 'test',
        modelVersion: '1',
        voiceId: 'fake',
        voiceVersion: '1',
        settings: {},
        format: 'wav',
      },
      synthesize: async () => wave(),
    },
    async () => ({ tier: 'free', used: 0, limit: 10000, canExtend: false }),
  );
  for (const card of cards) {
    const ref = { expectedRevision: 1, expectedContentHash: card.contentHash };
    await workspace.approve(card.id, ref);
    await workspace.selectAudio(card.id, {
      ...ref,
      placementIds: ['target', 'frontExample'],
    });
    const request = {
      ...ref,
      placementIds: ['target', 'frontExample'],
      mode: 'explicit' as const,
    };
    const preview = await audio.prepare(card.id, request);
    await audio.generate(card.id, { ...request, preflightId: preview.id });
  }
  const { state, client } = fakeAnki();
  const service = new DeliveryService(
    join(directory, 'delivery'),
    workspace,
    audio,
    client,
  );
  const request = {
    deckId: '2',
    cards: cards.map((card) => ({
      id: card.id,
      revision: 1,
      contentHash: card.contentHash,
    })),
  };
  return {
    directory,
    workspace,
    audio,
    cards,
    state,
    client,
    service,
    request,
  };
}

it('previews without Anki mutation, creates dedicated fields/media, and repeats without duplicates', async () => {
  const { service, request, state, cards } = await setup();
  const preview = await service.prepare(request);
  expect(preview.items[0]?.intent).toBe('create');
  expect(
    state.calls.some((method) =>
      ['notes.create', 'noteTypes.create', 'media.store'].includes(method),
    ),
  ).toBe(false);
  const sent = await service.send(preview.previewId);
  expect(sent.items[0]?.state).toBe('complete');
  expect(state.notes).toHaveLength(1);
  expect(state.notes[0]?.fields.AvSourceId).toBe(cards[0]?.id);
  expect(state.notes[0]?.fields.Target).toBe('awkward');
  expect(state.notes[0]?.fields.AudioTarget).toMatch(/^\[sound:av_.*\.wav\]$/);
  expect(state.notes[0]!.fields.AudioTarget!.slice(7, -1).length).toBeLessThan(
    100,
  );
  expect(state.notes[0]?.fields.AudioExample1).toBe('');
  expect(Object.keys(state.notes[0]!.fields)).toEqual(ankiFieldNames);
  expect(ankiTemplate.answerHtml).not.toContain('FrontSide');
  const creates = state.calls.filter(
    (method) => method === 'notes.create',
  ).length;
  const stores = state.calls.filter(
    (method) => method === 'media.store',
  ).length;
  await service.send(preview.previewId);
  const repeated = await service.prepare(request);
  expect(repeated.items[0]?.intent).toBe('unchanged');
  await service.send(repeated.previewId);
  expect(
    state.calls.filter((method) => method === 'notes.create'),
  ).toHaveLength(creates);
  expect(state.calls.filter((method) => method === 'media.store')).toHaveLength(
    stores,
  );
});

it('binds revision, approval, selected audio, deck and collection session to confirmation', async () => {
  const { service, workspace, cards, state, request } = await setup();
  const preview = await service.prepare(request);
  state.session = 'session-two';
  await expect(service.send(preview.previewId)).rejects.toThrow('session');
  expect(state.notes).toHaveLength(0);
  const refreshed = await service.prepare(request);
  await workspace.selectAudio(cards[0]!.id, {
    expectedRevision: 1,
    expectedContentHash: cards[0]!.contentHash,
    placementIds: ['target'],
  });
  const changed = await service.send(refreshed.previewId);
  expect(changed.items[0]?.state).toBe('failed');
  expect(state.notes).toHaveLength(0);
  const current = await service.prepare(request);
  await workspace.update(cards[0]!.id, {
    expectedRevision: 1,
    fields: { ...cards[0]!.fields, meaning: 'Edited.' },
    included: true,
  });
  expect((await service.send(current.previewId)).items[0]?.state).toBe(
    'failed',
  );
  expect(state.notes).toHaveLength(0);
});

it('reconciles a lost creation response after restart without creating again', async () => {
  const { directory, service, workspace, audio, client, request, state } =
    await setup();
  state.lost = 'after';
  const preview = await service.prepare(request);
  const result = await service.send(preview.previewId);
  expect(result.items[0]?.state).toBe('ambiguous');
  expect(state.notes).toHaveLength(1);
  const restarted = new DeliveryService(
    join(directory, 'delivery'),
    workspace,
    audio,
    client,
  );
  expect((await restarted.status()).items[0]?.state).toBe('ambiguous');
  const reconciled = await restarted.prepare(request);
  expect(reconciled.items[0]?.intent).toBe('reconcile');
  await restarted.send(reconciled.previewId);
  expect(
    state.calls.filter((method) => method === 'notes.create'),
  ).toHaveLength(1);
  expect((await restarted.status()).items[0]?.state).toBe('complete');
});

it('blocks a blind retry if an ambiguous creation is still absent', async () => {
  const { service, request, state } = await setup();
  state.lost = 'before';
  const preview = await service.prepare(request);
  await service.send(preview.previewId);
  const retry = await service.prepare(request);
  expect(retry.items[0]?.intent).toBe('omit');
  expect(retry.items[0]?.reason).toContain('reconciled');
  await service.send(retry.previewId);
  expect(
    state.calls.filter((method) => method === 'notes.create'),
  ).toHaveLength(1);
  expect(state.notes).toHaveLength(0);
});

it('retains partial outcomes and does not duplicate a successful sibling', async () => {
  const { service, request, state } = await setup(2);
  state.lost = 'after';
  const preview = await service.prepare(request);
  const result = await service.send(preview.previewId);
  expect(result.items.map((item) => item.state)).toEqual([
    'ambiguous',
    'complete',
  ]);
  expect(state.notes).toHaveLength(2);
  const retry = await service.prepare(request);
  await service.send(retry.previewId);
  expect(
    state.calls.filter((method) => method === 'notes.create'),
  ).toHaveLength(2);
});

it('keeps preview omissions in the final and replayed per-item results', async () => {
  const { service, workspace, request, cards, state } = await setup(2);
  await workspace.selectAudio(cards[1]!.id, {
    expectedRevision: 1,
    expectedContentHash: cards[1]!.contentHash,
    placementIds: ['examples:0'],
  });
  const preview = await service.prepare(request);
  expect(preview.items.map((item) => item.intent)).toEqual(['create', 'omit']);
  const result = await service.send(preview.previewId);
  expect(result.items.map((item) => item.state)).toEqual([
    'complete',
    'blocked',
  ]);
  expect((await service.send(preview.previewId)).items).toEqual(result.items);
  expect(state.notes).toHaveLength(1);
});

it('blocks duplicate identity, changed layout, missing receipts targets and cross-profile reuse', async () => {
  const { service, request, state } = await setup();
  const preview = await service.prepare(request);
  await service.send(preview.previewId);
  state.duplicates = true;
  expect((await service.prepare(request)).items[0]?.intent).toBe('omit');
  state.duplicates = false;
  const old = state.model!.css;
  state.model!.css = 'changed';
  await expect(service.prepare(request)).rejects.toThrow('layout');
  state.model!.css = old;
  state.profile = 'Other';
  expect((await service.prepare(request)).items[0]?.intent).toBe('omit');
  state.profile = 'Disposable';
  state.notes = [];
  expect((await service.prepare(request)).items[0]?.intent).toBe('omit');
  expect(
    state.calls.filter((method) => method === 'notes.create'),
  ).toHaveLength(1);
});

it('retains pending intent on disconnect and requires a new explicit confirmation', async () => {
  const { directory, service, request, state, workspace, audio, client } =
    await setup();
  const preview = await service.prepare(request);
  state.unavailable = true;
  await expect(service.send(preview.previewId)).rejects.toThrow();
  const restarted = new DeliveryService(
    join(directory, 'delivery'),
    workspace,
    audio,
    client,
  );
  expect((await restarted.status()).items[0]?.state).toBe('pending');
  state.unavailable = false;
  state.session = 'new-session';
  expect(state.notes).toHaveLength(0);
  await expect(restarted.send(preview.previewId)).rejects.toThrow('expired');
  const next = await restarted.prepare(request);
  expect(state.notes).toHaveLength(0);
  await restarted.send(next.previewId);
  expect(state.notes).toHaveLength(1);
});

it('reports unattempted cards after a mid-batch disconnect and recovers without duplicates', async () => {
  const { service, request, state } = await setup(2);
  const preview = await service.prepare(request);
  state.disconnectDuringMedia = true;
  const result = await service.send(preview.previewId);
  expect(result.items.map((item) => item.state)).toEqual(['failed', 'pending']);
  expect(result.items[1]?.reason).toContain('Not attempted');
  expect((await service.status()).items[1]?.reason).toContain('Not attempted');
  expect(state.notes).toHaveLength(0);
  state.unavailable = false;
  const retry = await service.prepare(request);
  await service.send(retry.previewId);
  expect(state.notes).toHaveLength(2);
});

it('never overwrites colliding media', async () => {
  const { service, request, state, directory } = await setup();
  const preview = await service.prepare(request);
  const manifest = JSON.parse(
    await readFile(join(directory, 'delivery', 'delivery.json'), 'utf8'),
  ) as { entries: { fields: Record<string, string> }[] };
  const filename = manifest.entries[0]!.fields.AudioTarget!.slice(7, -1);
  state.media.set(filename, Buffer.from('unrelated').toString('base64'));
  const result = await service.send(preview.previewId);
  expect(result.items[0]?.state).toBe('failed');
  expect(state.notes).toHaveLength(0);
  expect(state.calls).not.toContain('media.store');
});

it('omits unapproved/incomplete cards and protects exact source text from HTML and sound-tag injection', async () => {
  const { service, workspace, cards, request, state } = await setup();
  const card = cards[0]!;
  const fields = ankiFields(
    {
      ...card,
      fields: {
        ...card.fields,
        target: '<script>alert(1)</script> [sound:other.mp3]',
      },
    },
    {},
  );
  expect(fields.Target).not.toContain('<script>');
  expect(fields.Target).not.toContain('[sound:');
  expect(
    JSON.parse(Buffer.from(fields.AvContent!, 'base64').toString()).target,
  ).toBe('<script>alert(1)</script> [sound:other.mp3]');
  await workspace.selectAudio(card.id, {
    expectedRevision: 1,
    expectedContentHash: card.contentHash,
    placementIds: ['examples:0'],
  });
  const blocked = (await service.prepare(request)).items[0];
  expect(blocked?.target).toBe(card.fields.target);
  expect(blocked?.reason).toContain('incomplete');
  expect(blocked?.reason).toContain(
    'Generate or retry the selected audio items',
  );
  expect(blocked?.audioCount).toBe(0);
  await workspace.update(card.id, {
    expectedRevision: 1,
    fields: card.fields,
    included: false,
  });
  expect(
    (
      await service.prepare({
        ...request,
        cards: [{ id: card.id, revision: 2, contentHash: card.contentHash }],
      })
    ).items[0]?.intent,
  ).toBe('omit');
  expect(state.notes).toHaveLength(0);
});

it('does not treat a delivered note with missing Anki media as ready', async () => {
  const { service, request, state } = await setup();
  const preview = await service.prepare(request);
  await service.send(preview.previewId);
  state.media.clear();
  const repeated = await service.prepare(request);
  expect(repeated.items[0]?.intent).toBe('omit');
  expect(repeated.items[0]?.reason).toContain('missing or altered');
});

it('blocks changed delivered content instead of updating or recreating a studied identity', async () => {
  const { service, request, state, workspace, audio, cards } = await setup();
  const preview = await service.prepare(request);
  await service.send(preview.previewId);
  const noteId = state.notes[0]!.id;
  const cardId = state.notes[0]!.cardIds[0];
  const changed = (
    await workspace.update(cards[0]!.id, {
      expectedRevision: 1,
      included: true,
      fields: { ...cards[0]!.fields, meaning: 'A revised explanation.' },
    })
  ).cards[0]!;
  const ref = { expectedRevision: 2, expectedContentHash: changed.contentHash };
  await workspace.approve(changed.id, ref);
  await workspace.selectAudio(changed.id, {
    ...ref,
    placementIds: ['target', 'frontExample'],
  });
  const batch = {
    ...ref,
    placementIds: ['target', 'frontExample'],
    mode: 'explicit' as const,
  };
  const speech = await audio.prepare(changed.id, batch);
  await audio.generate(changed.id, { ...batch, preflightId: speech.id });
  const revised = await service.prepare({
    deckId: '2',
    cards: [{ id: changed.id, revision: 2, contentHash: changed.contentHash }],
  });
  expect(revised.items[0]?.intent).toBe('omit');
  expect(revised.items[0]?.reason).toContain('update workflow');
  expect(state.notes).toHaveLength(1);
  expect(state.notes[0]?.id).toBe(noteId);
  expect(state.notes[0]?.cardIds[0]).toBe(cardId);
  expect(state.notes[0]?.fields.AvRevision).toBe('1');
  expect(state.calls).not.toContain('notes.update');
});

it('enforces origin/session, exact body schemas, explicit deck and listening confirmation at HTTP boundary', async () => {
  const { service, workspace, audio, request, state } = await setup();
  const hosts = new Set<string>();
  const handler = createApiHandler({
    expectedHosts: hosts,
    expectedOrigins: new Set(['http://allowed.test']),
    workspace,
    audio,
    delivery: service,
    sessionToken: 'test-token',
    readStatus: async () => ({
      server: { status: 'ready' },
      anki: { status: 'unavailable', reason: 'not-running-or-unreachable' },
    }),
  });
  const server = createServer((req, res) => {
    void handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  hosts.add(`127.0.0.1:${port}`);
  const base = `http://127.0.0.1:${port}/api/delivery`;
  const post = (path: string, body: unknown, token = true) =>
    fetch(`${base}/${path}`, {
      method: 'POST',
      headers: {
        Origin: 'http://allowed.test',
        'Content-Type': 'application/json',
        ...(token ? { 'X-Workspace-Token': 'test-token' } : {}),
      },
      body: JSON.stringify(body),
    });
  try {
    expect((await post('prepare', request, false)).status).toBe(403);
    expect((await post('prepare', { cards: request.cards })).status).toBe(400);
    expect(
      (await post('prepare', { ...request, unexpected: true })).status,
    ).toBe(400);
    const response = await post('prepare', request);
    expect(response.status).toBe(200);
    const preview = (await response.json()) as { previewId: string };
    expect(
      (await post('send', { previewId: preview.previewId, reviewed: false }))
        .status,
    ).toBe(400);
    expect(state.notes).toHaveLength(0);
    expect(
      (await post('send', { previewId: preview.previewId, reviewed: true }))
        .status,
    ).toBe(200);
    expect(state.notes).toHaveLength(1);
    const receipts = await (await fetch(`${base}/status`)).text();
    expect(receipts).not.toContain('session-one');
    expect(receipts).not.toContain('payloadHash');
    expect(receipts).not.toContain('AvContent');
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
