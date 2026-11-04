import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it } from 'vitest';
import { fakeAnki, wave } from '../helpers/fake-anki';
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
