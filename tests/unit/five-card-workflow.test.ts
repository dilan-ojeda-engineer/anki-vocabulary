import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it } from 'vitest';
import { z } from 'zod';
import { previewImport } from '../../src/server/card-import';
import { WorkspaceStore } from '../../src/server/workspace';
import {
  cardSides,
  cardText,
  coachFieldSchema,
} from '../../src/shared/card-display';
import { extractAudioItems } from '../../src/shared/audio-plan';
import { AudioService } from '../../src/server/audio-service';
import { SpeechFailure } from '../../src/server/audio-cache';
import { DeliveryService } from '../../src/server/delivery-service';
import { NoteUpdateService } from '../../src/server/note-update-service';
import { createApiHandler } from '../../src/server/http';
import { readAnkiStatus } from '../../src/server/anki-status';
import { cardSchema } from '../../src/integrations/anki/schemas';
import { fakeAnki, wave } from '../helpers/fake-anki';

const folders: string[] = [];
const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  for (const server of servers.splice(0))
    if (server.listening)
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
  await Promise.all(
    folders.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

it('completes the five-card workflow offline, resumes a partial batch after restart, and explicitly delivers and updates without duplicates', async () => {
  const fixtures = z
    .array(coachFieldSchema)
    .parse(
      JSON.parse(
        await readFile(
          new URL('../fixtures/av036-cards.json', import.meta.url),
          'utf8',
        ),
      ),
    );
  expect(fixtures.map((fields) => fields.target)).toEqual([
    'awkward',
    'draining',
    'went',
    'put off',
    'fuel',
  ]);
  const directory = await mkdtemp(join(tmpdir(), 'av036-workflow-'));
  folders.push(directory);
  const { client, state } = fakeAnki();
  state.unavailable = true;
  let synthesis = 0;
  let quotaFailure = true;
  const provider = {
    configuration: {
      providerId: 'fake',
      modelId: 'workflow',
      modelVersion: '1',
      voiceId: 'fixture',
      voiceVersion: '1',
      settings: {},
      format: 'wav' as const,
    },
    synthesize: async () => {
      synthesis++;
      if (quotaFailure && synthesis === 3) {
        quotaFailure = false;
        throw new SpeechFailure('quota');
      }
      return wave(synthesis);
    },
  };
  const services = () => {
    const workspace = new WorkspaceStore(directory);
    const audio = new AudioService(
      join(directory, 'audio'),
      workspace,
      provider,
      async () => ({ tier: 'free', used: 0, limit: 10000, canExtend: false }),
    );
    const delivery = new DeliveryService(
      join(directory, 'delivery'),
      workspace,
      audio,
      client,
    );
    const notes = new NoteUpdateService(
      join(directory, 'delivery'),
      delivery,
      workspace,
      audio,
      client,
    );
    return { workspace, audio, delivery, notes };
  };
  let app = services();
  async function serve() {
    const hosts = new Set<string>();
    const handler = createApiHandler({
      expectedHosts: hosts,
      expectedOrigins: new Set(['http://fixture.test']),
      sessionToken: 'test-token',
      ...app,
      readStatus: () => readAnkiStatus(client),
    });
    const server = createServer((req, res) => {
      void handler(req, res).catch(() => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    servers.push(server);
    const host = `127.0.0.1:${(server.address() as AddressInfo).port}`;
    hosts.add(host);
    return { server, url: `http://${host}` };
  }
  let web = await serve();
  const post = async (path: string, body: unknown) =>
    fetch(`${web.url}${path}`, {
      method: 'POST',
      headers: {
        Origin: 'http://fixture.test',
        'Content-Type': 'application/json',
        'X-Workspace-Token': 'test-token',
      },
      body: JSON.stringify(body),
    });
  expect(await (await fetch(`${web.url}/api/status`)).json()).toMatchObject({
    server: { status: 'ready' },
    anki: { status: 'unavailable' },
  });
  const input = {
    format: 'json',
    text: JSON.stringify([...fixtures, { target: 'invalid entry' }]),
  };
  const response = await post('/api/import/preview', input);
  expect(response.status).toBe(200);
  const preview = previewImport(input as { format: 'json'; text: string });
  expect(preview.entries).toHaveLength(6);
  expect(
    preview.entries.slice(0, 5).every((entry) => entry.issues.length === 0),
  ).toBe(true);
  expect(preview.entries[5]!.issues.length).toBeGreaterThan(0);
  await expect(
    app.workspace.add(preview, [1, 2, 3, 4, 5, 6]),
  ).rejects.toThrow();
  expect((await app.workspace.read()).cards).toEqual([]);
  await app.workspace.add(preview, [1, 2, 3, 4, 5]);
  for (const original of (await app.workspace.read()).cards) {
    const sides = cardSides(original.fields);
    expect(sides.front).toContain(String(original.fields.target));
    expect(sides.front).toContain(String(original.fields.frontExample));
    expect(sides.front).toContain('What does this expression mean?');
    expect(sides.back).toContain(String(original.fields.meaning));
    expect(
      previewImport({ format: 'paste', text: cardText(original.fields) })
        .entries[0]!.fields,
    ).toEqual(original.fields);
    await app.workspace.approve(original.id, {
      expectedRevision: 1,
      expectedContentHash: original.contentHash,
    });
    const edited = (
      await app.workspace.update(original.id, {
        expectedRevision: 1,
        fields: {
          ...original.fields,
          meaning: `${original.fields.meaning} Revised explanation.`,
        },
        included: true,
      })
    ).cards.find((card) => card.id === original.id)!;
    expect(edited.approval).toBeNull();
    expect(edited.audioSelection).toBeNull();
    await expect(
      app.audio.prepare(edited.id, {
        expectedRevision: 2,
        expectedContentHash: edited.contentHash,
        mode: 'missing',
        placementIds: [],
      }),
    ).rejects.toThrow('approval');
    const restored = (
      await app.workspace.update(original.id, {
        expectedRevision: 2,
        fields: original.fields,
        included: true,
      })
    ).cards.find((card) => card.id === original.id)!;
    await app.workspace.approve(restored.id, {
      expectedRevision: 3,
      expectedContentHash: restored.contentHash,
    });
    const items = extractAudioItems(restored.fields);
    expect(items.map((item) => item.placementId)).toEqual([
      'target',
      'frontExample',
      'examples:0',
      'examples:1',
      'examples:2',
      'examples:3',
    ]);
    expect(
      items.every((item) =>
        ['target', 'frontExample', 'examples'].includes(item.fieldKey),
      ),
    ).toBe(true);
    await app.workspace.selectAudio(restored.id, {
      expectedRevision: 3,
      expectedContentHash: restored.contentHash,
      placementIds: items.map((item) => item.placementId),
    });
  }
  const cards = (await app.workspace.read()).cards;
  async function generate(
    card: (typeof cards)[number],
    mode: 'explicit' | 'missing' | 'replacement',
    placementIds: string[],
  ) {
    const request = {
      expectedRevision: card.revision,
      expectedContentHash: card.contentHash,
      mode,
      placementIds,
    };
    const preview = await app.audio.prepare(card.id, request);
    return app.audio.generate(card.id, { ...request, preflightId: preview.id });
  }
  const first = cards[0]!;
  const single = await generate(first, 'explicit', ['target']);
  const originalKey = single.items[0]!.artifactKey!;
  expect(
    single.items.filter((item) => item.audioState === 'complete'),
  ).toHaveLength(1);
  const partial = await generate(first, 'missing', []);
  expect(
    partial.items.filter((item) => item.audioState === 'complete'),
  ).toHaveLength(2);
  expect(partial.items.some((item) => item.audioState === 'paused')).toBe(true);
  expect(state.notes).toHaveLength(0);
  await new Promise<void>((resolve, reject) =>
    web.server.close((error) => (error ? reject(error) : resolve())),
  );
  app = services();
  web = await serve();
  expect((await app.workspace.read()).cards).toEqual(cards);
  expect(await app.audio.media(originalKey)).not.toBeNull();
  const resumed = await generate(first, 'missing', []);
  expect(resumed.items.every((item) => item.audioState === 'complete')).toBe(
    true,
  );
  for (const card of cards.slice(1))
    expect(
      (await generate(card, 'missing', [])).items.every(
        (item) => item.audioState === 'complete',
      ),
    ).toBe(true);
  const callsBeforeCachedRetry = synthesis;
  for (const card of cards)
    await generate(
      card,
      'explicit',
      extractAudioItems(card.fields).map((item) => item.placementId),
    );
  expect(synthesis).toBe(callsBeforeCachedRetry);
  expect(
    state.calls.filter((method) => method === 'notes.create'),
  ).toHaveLength(0);
  state.unavailable = false;
  expect(await (await fetch(`${web.url}/api/status`)).json()).toMatchObject({
    anki: {
      status: 'connected',
      decks: expect.arrayContaining([
        expect.objectContaining({ name: 'English::Test' }),
      ]),
    },
  });
  expect(state.notes).toHaveLength(0);
  const request = {
    deckId: '2',
    cards: cards.map((card) => ({
      id: card.id,
      revision: card.revision,
      contentHash: card.contentHash,
    })),
  };
  const deliveryPreview = await app.delivery.prepare(request);
  expect(state.notes).toHaveLength(0);
  expect(
    (await app.delivery.send(deliveryPreview.previewId)).items.every(
      (item) => item.state === 'complete',
    ),
  ).toBe(true);
  const ids = state.notes.map((note) => ({
    id: note.id,
    cardIds: note.cardIds,
    source: note.fields.AvSourceId,
  }));
  const mediaCount = state.media.size;
  app = services();
  const repeated = await app.delivery.prepare(request);
  expect(
    (await app.delivery.send(repeated.previewId)).items.every(
      (item) => item.intent === 'unchanged' && item.state === 'complete',
    ),
  ).toBe(true);
  expect(
    state.notes.map((note) => ({
      id: note.id,
      cardIds: note.cardIds,
      source: note.fields.AvSourceId,
    })),
  ).toEqual(ids);
  expect(state.media.size).toBe(mediaCount);
  expect(
    state.calls.filter((method) => method === 'notes.create'),
  ).toHaveLength(5);
  state.studied = true;
  const note = state.notes[0]!;
  const before = structuredClone(note.fields);
  const cardBefore = await client.call(
    'cards.get',
    { id: note.cardIds[0], session: state.session },
    cardSchema,
  );
  const loaded = await app.notes.load('2', note.id);
  const replacement = await generate(first, 'replacement', ['target']);
  expect(replacement.items[0]!.artifactKey).not.toBe(originalKey);
  const update = await app.notes.prepare({
    loadId: loaded.loadId,
    card: {
      id: first.id,
      revision: first.revision,
      contentHash: first.contentHash,
    },
    mode: 'audio',
    placementId: 'target',
  });
  expect(update.audio).toHaveLength(1);
  expect(update.audio[0]!.currentUrl).not.toBeNull();
  expect(update.audio[0]!.proposedUrl).not.toBeNull();
  expect((await app.notes.send(update.previewId)).state).toBe('complete');
  expect(Object.keys(state.patches.at(-1)!)).toEqual(['AudioTarget']);
  expect(state.media.has(before.AudioTarget!.slice(7, -1))).toBe(true);
  expect(
    await client.call(
      'cards.get',
      { id: note.cardIds[0], session: state.session },
      cardSchema,
    ),
  ).toEqual(cardBefore);
  expect(
    state.notes.map((note) => ({
      id: note.id,
      cardIds: note.cardIds,
      source: note.fields.AvSourceId,
    })),
  ).toEqual(ids);
  expect((await app.delivery.status()).items).toHaveLength(5);
}, 30000);
