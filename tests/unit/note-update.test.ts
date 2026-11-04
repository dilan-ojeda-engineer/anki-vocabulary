import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { fakeAnki, wave } from '../helpers/fake-anki';
import { DeliveryService } from '../../src/server/delivery-service';
import { NoteUpdateService } from '../../src/server/note-update-service';
import { AudioService } from '../../src/server/audio-service';
import { WorkspaceStore } from '../../src/server/workspace';
import { previewImport } from '../../src/server/card-import';
import { englishCoachFieldsFixture } from '../../src/shared/fixtures/workflow';
import { createApiHandler } from '../../src/server/http';
import { planNoteAudio } from '../../src/shared/note-audio-plan';

const folders: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    folders.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), 'anki-note-update-'));
  folders.push(directory);
  const workspace = new WorkspaceStore(directory);
  const card = (
    await workspace.add(
      previewImport({
        format: 'json',
        text: JSON.stringify([
          {
            ...englishCoachFieldsFixture,
            examples: [
              ...englishCoachFieldsFixture.examples,
              'The timing felt awkward.',
            ],
          },
        ]),
      }),
      [1],
    )
  ).cards[0]!;
  let synthesis = 0;
  const audio = new AudioService(
    join(directory, 'audio'),
    workspace,
    {
      configuration: {
        providerId: 'fake',
        modelId: 'fixture',
        modelVersion: '1',
        voiceId: 'fixture',
        voiceVersion: '1',
        settings: {},
        format: 'wav',
      },
      synthesize: async () => wave(++synthesis),
    },
    async () => ({ tier: 'free', used: 0, limit: 10000, canExtend: false }),
  );
  const ref = {
    expectedRevision: card.revision,
    expectedContentHash: card.contentHash,
  };
  await workspace.approve(card.id, ref);
  await workspace.selectAudio(card.id, {
    ...ref,
    placementIds: ['target', 'frontExample'],
  });
  const batch = {
    ...ref,
    mode: 'explicit' as const,
    placementIds: ['target', 'frontExample'],
  };
  const prepared = await audio.prepare(card.id, batch);
  await audio.generate(card.id, { ...batch, preflightId: prepared.id });
  const { client, state } = fakeAnki();
  const delivery = new DeliveryService(
    join(directory, 'delivery'),
    workspace,
    audio,
    client,
  );
  const preview = await delivery.prepare({
    deckId: '2',
    cards: [
      { id: card.id, revision: card.revision, contentHash: card.contentHash },
    ],
  });
  await delivery.send(preview.previewId);
  state.studied = true;
  const service = new NoteUpdateService(
    join(directory, 'delivery'),
    delivery,
    workspace,
    audio,
    client,
  );
  const noteId = state.notes[0]!.id;
  async function edited() {
    const current = (await workspace.read()).cards[0]!;
    const next = (
      await workspace.update(current.id, {
        expectedRevision: current.revision,
        fields: {
          ...current.fields,
          meaning: 'An uncomfortable social situation, explained more clearly.',
        },
        included: true,
      })
    ).cards[0]!;
    const ref = {
      expectedRevision: next.revision,
      expectedContentHash: next.contentHash,
    };
    await workspace.approve(next.id, ref);
    await workspace.selectAudio(next.id, {
      ...ref,
      placementIds: ['target', 'frontExample'],
    });
    const batch = {
      ...ref,
      mode: 'explicit' as const,
      placementIds: ['target', 'frontExample'],
    };
    const preview = await audio.prepare(next.id, batch);
    await audio.generate(next.id, { ...batch, preflightId: preview.id });
    return next;
  }
  return {
    directory,
    workspace,
    card,
    audio,
    client,
    state,
    delivery,
    service,
    noteId,
    edited,
    synthesis: () => synthesis,
  };
}

it('loads verified note values and current audio without changing approval or Anki', async () => {
  const { service, workspace, card, state, noteId } = await setup();
  const calls = state.calls.length;
  expect((await service.list('2')).notes).toEqual([
    { sourceId: card.id, noteId, target: 'awkward' },
  ]);
  expect((await service.list('3')).notes).toEqual([]);
  const loaded = await service.load('2', noteId);
  expect(loaded.fields).toEqual(card.fields);
  expect(loaded.audio).toHaveLength(2);
  expect(await service.media(loaded.audio[0]!.url.split('/').at(-1)!)).not.toBe(
    null,
  );
  expect(state.calls.slice(calls)).not.toContain('notes.update');
  expect((await workspace.read()).cards[0]!.approval).not.toBe(null);
  expect(JSON.stringify(loaded)).not.toContain(state.session);
});

it('shows a field diff, updates an existing studied note once and keeps identity/scheduling', async () => {
  const { service, state, noteId, edited, delivery } = await setup();
  const original = structuredClone(state.notes[0]!);
  const loaded = await service.load('2', noteId);
  const next = await edited();
  const preview = await service.prepare({
    loadId: loaded.loadId,
    card: {
      id: next.id,
      revision: next.revision,
      contentHash: next.contentHash,
    },
    mode: 'content',
  });
  expect(preview.changes.map((item) => item.field)).toContain('Meaning:');
  expect(state.updateCount).toBe(0);
  expect((await service.send(preview.previewId)).state).toBe('complete');
  expect((await service.send(preview.previewId)).state).toBe('complete');
  expect(state.updateCount).toBe(1);
  expect(state.notes).toHaveLength(1);
  expect(state.notes[0]!.id).toBe(original.id);
  expect(state.notes[0]!.cardIds).toEqual(original.cardIds);
  expect(state.cardFlags).toBe(0);
  expect(state.studied).toBe(true);
  expect(state.notes[0]!.fields.Meaning).toBe(next.fields.meaning);
  expect((await delivery.status()).items[0]).toMatchObject({
    revision: 2,
    noteId,
    state: 'complete',
  });
  expect(state.calls).not.toContain('notes.delete');
});

it('preserves unselected existing audio during a content update with one new clip', async () => {
  const { service, workspace, audio, state, noteId, edited } = await setup();
  const loaded = await service.load('2', noteId);
  const original = structuredClone(state.notes[0]!.fields);
  const next = await edited();
  const ref = {
    expectedRevision: next.revision,
    expectedContentHash: next.contentHash,
  };
  await workspace.selectAudio(next.id, { ...ref, placementIds: ['target'] });
  const request = {
    ...ref,
    mode: 'replacement' as const,
    placementIds: ['target'],
  };
  const batch = await audio.prepare(next.id, request);
  await audio.generate(next.id, { ...request, preflightId: batch.id });
  const preview = await service.prepare({
    loadId: loaded.loadId,
    card: {
      id: next.id,
      revision: next.revision,
      contentHash: next.contentHash,
    },
    mode: 'content',
  });
  expect(preview.audio.map((item) => item.placementId)).toEqual(['target']);
  expect((await service.send(preview.previewId)).state).toBe('complete');
  expect(state.notes[0]!.fields.AudioTarget).not.toBe(original.AudioTarget);
  expect(state.notes[0]!.fields.AudioFrontExample).toBe(
    original.AudioFrontExample,
  );
  expect(state.patches.at(-1)).not.toHaveProperty('AudioFrontExample');
  expect(state.model!.fields).toHaveLength(28);
});

it('keeps verified existing audio when a content-only update selects no clips', async () => {
  const { service, workspace, state, noteId, edited } = await setup();
  const loaded = await service.load('2', noteId);
  const original = structuredClone(state.notes[0]!.fields);
  const next = await edited();
  await workspace.selectAudio(next.id, {
    expectedRevision: next.revision,
    expectedContentHash: next.contentHash,
    placementIds: [],
  });
  const preview = await service.prepare({
    loadId: loaded.loadId,
    card: {
      id: next.id,
      revision: next.revision,
      contentHash: next.contentHash,
    },
    mode: 'content',
  });
  expect(preview.audio).toEqual([]);
  expect((await service.send(preview.previewId)).state).toBe('complete');
  expect(state.notes[0]!.fields.AudioTarget).toBe(original.AudioTarget);
  expect(state.notes[0]!.fields.AudioFrontExample).toBe(
    original.AudioFrontExample,
  );
});

it('blocks changed spoken text until its replacement is ready, keeping other clips', async () => {
  const { service, workspace, audio, state, noteId, card } = await setup();
  const loaded = await service.load('2', noteId);
  const original = structuredClone(state.notes[0]!);
  const next = (
    await workspace.update(card.id, {
      expectedRevision: 1,
      included: true,
      fields: {
        ...card.fields,
        frontExample: 'It was an awkward conversation yesterday.',
      },
    })
  ).cards[0]!;
  const ref = {
    expectedRevision: next.revision,
    expectedContentHash: next.contentHash,
  };
  await workspace.approve(next.id, ref);
  await workspace.selectAudio(next.id, { ...ref, placementIds: [] });
  const request = {
    loadId: loaded.loadId,
    card: {
      id: next.id,
      revision: next.revision,
      contentHash: next.contentHash,
    },
    mode: 'content' as const,
  };
  await expect(service.prepare(request)).rejects.toThrow(
    'Generate and select updated audio for frontExample',
  );
  expect(state.notes[0]).toEqual(original);
  expect(state.updateCount).toBe(0);
  await workspace.selectAudio(next.id, {
    ...ref,
    placementIds: ['frontExample'],
  });
  const generation = {
    ...ref,
    mode: 'explicit' as const,
    placementIds: ['frontExample'],
  };
  const batch = await audio.prepare(next.id, generation);
  await audio.generate(next.id, { ...generation, preflightId: batch.id });
  const preview = await service.prepare(request);
  expect((await service.send(preview.previewId)).state).toBe('complete');
  expect(state.notes[0]!.fields.AudioTarget).toBe(original.fields.AudioTarget);
  expect(state.notes[0]!.fields.AudioFrontExample).not.toBe(
    original.fields.AudioFrontExample,
  );
});

it('guides partial generation into one reviewed content update while preserving unchanged audio', async () => {
  const { service, workspace, audio, state, noteId, card } = await setup();
  const loaded = await service.load('2', noteId);
  const original = structuredClone(state.notes[0]!.fields);
  const next = (
    await workspace.update(card.id, {
      expectedRevision: 1,
      included: true,
      fields: {
        ...card.fields,
        frontExample: 'It was an awkward conversation yesterday.',
      },
    })
  ).cards[0]!;
  const ref = {
    expectedRevision: next.revision,
    expectedContentHash: next.contentHash,
  };
  await workspace.approve(card.id, ref);
  async function generate(placementIds: string[]) {
    const request = { ...ref, mode: 'explicit' as const, placementIds };
    const prepared = await audio.prepare(card.id, request);
    return audio.generate(card.id, { ...request, preflightId: prepared.id });
  }
  const partial = planNoteAudio(loaded, await generate(['examples:0']));
  expect(
    partial.filter((item) => item.needsAudio).map((item) => item.placementId),
  ).toEqual(['frontExample']);
  expect(partial.find((item) => item.placementId === 'target')).toMatchObject({
    unchanged: true,
    needsAudio: false,
    ready: false,
  });
  const complete = planNoteAudio(loaded, await generate(['frontExample']));
  expect(complete.filter((item) => item.needsAudio)).toEqual([]);
  const readyIds = complete
    .filter((item) => item.ready)
    .map((item) => item.placementId);
  await workspace.selectAudio(card.id, { ...ref, placementIds: readyIds });
  const preview = await service.prepare({
    loadId: loaded.loadId,
    card: {
      id: card.id,
      revision: next.revision,
      contentHash: next.contentHash,
    },
    mode: 'content',
  });
  expect(preview.audio.map((item) => item.placementId)).toEqual([
    'frontExample',
    'examples:0',
  ]);
  expect((await service.send(preview.previewId)).state).toBe('complete');
  expect(state.notes[0]!.fields.AudioTarget).toBe(original.AudioTarget);
  expect(state.patches.at(-1)).not.toHaveProperty('AudioTarget');
  expect(state.studied).toBe(true);
});

it('keeps an editing context and playback after a long audio session, but expires write previews', async () => {
  const { service, state, noteId, edited } = await setup();
  const loaded = await service.load('2', noteId);
  const next = await edited();
  const now = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 60 * 60 * 1000);
  expect(await service.media(loaded.audio[0]!.url.split('/').at(-1)!)).not.toBe(
    null,
  );
  const request = {
    loadId: loaded.loadId,
    card: {
      id: next.id,
      revision: next.revision,
      contentHash: next.contentHash,
    },
    mode: 'content' as const,
  };
  const preview = await service.prepare(request);
  expect(state.updateCount).toBe(0);
  clock.mockReturnValue(now + 66 * 60 * 1000);
  await expect(service.send(preview.previewId)).rejects.toThrow(
    'Update preview expired',
  );
  expect(state.updateCount).toBe(0);
  const reviewedAgain = await service.prepare(request);
  expect((await service.send(reviewedAgain.previewId)).state).toBe('complete');
  expect(state.updateCount).toBe(1);
});

it('still rejects external edits and session changes after a long editing session', async () => {
  for (const conflict of ['content', 'session'] as const) {
    const { service, state, noteId, card } = await setup();
    const loaded = await service.load('2', noteId);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60 * 60 * 1000);
    if (conflict === 'content')
      state.notes[0]!.fields.Meaning = 'External edit';
    else state.session = 'different-session';
    await expect(
      service.prepare({
        loadId: loaded.loadId,
        card: {
          id: card.id,
          revision: card.revision,
          contentHash: card.contentHash,
        },
        mode: 'content',
      }),
    ).rejects.toThrow('Anki changed after loading');
    expect(state.updateCount).toBe(0);
    vi.restoreAllMocks();
  }
});

it('recovers an evicted or restarted editing context by reloading without losing saved text or audio', async () => {
  const {
    service,
    directory,
    delivery,
    workspace,
    audio,
    client,
    noteId,
    edited,
  } = await setup();
  const oldest = await service.load('2', noteId);
  const next = await edited();
  for (let i = 0; i < 100; i++) await service.load('2', noteId);
  const request = {
    loadId: oldest.loadId,
    card: {
      id: next.id,
      revision: next.revision,
      contentHash: next.contentHash,
    },
    mode: 'content' as const,
  };
  await expect(service.prepare(request)).rejects.toThrow(
    'Reload Anki snapshot',
  );
  const restarted = new NoteUpdateService(
    join(directory, 'delivery'),
    delivery,
    workspace,
    audio,
    client,
  );
  await expect(restarted.prepare(request)).rejects.toThrow(
    'Reload Anki snapshot',
  );
  const before = await workspace.read();
  const clips = await audio.review(next.id, next.revision, next.contentHash);
  const loaded = await restarted.load('2', noteId);
  expect(await workspace.read()).toEqual(before);
  expect(await audio.review(next.id, next.revision, next.contentHash)).toEqual(
    clips,
  );
  expect(
    (
      await restarted.prepare({ ...request, loadId: loaded.loadId })
    ).changes.map((item) => item.field),
  ).toContain('Meaning:');
});

it('creates immutable replacement audio and patches only the confirmed audio field', async () => {
  const { service, workspace, audio, card, state, noteId, synthesis } =
    await setup();
  const loaded = await service.load('2', noteId);
  const before = structuredClone(state.notes[0]!.fields);
  const review = await audio.review(card.id, card.revision, card.contentHash);
  const oldKey = review.items.find(
    (item) => item.placementId === 'target',
  )!.artifactKey!;
  const request = {
    expectedRevision: 1,
    expectedContentHash: card.contentHash,
    mode: 'replacement' as const,
    placementIds: ['target'],
  };
  const batch = await audio.prepare(card.id, request);
  expect(batch.uncachedCharacters).toBe('awkward'.length);
  await audio.generate(card.id, { ...request, preflightId: batch.id });
  await audio.generate(card.id, { ...request, preflightId: batch.id });
  expect(synthesis()).toBe(3);
  const replaced = await audio.review(card.id, 1, card.contentHash);
  const item = replaced.items.find((item) => item.placementId === 'target')!;
  expect(item.artifactKey).not.toBe(oldKey);
  expect(item.previousKey).toBe(oldKey);
  expect(await audio.media(oldKey)).not.toBe(null);
  const ordinary = {
    expectedRevision: 1,
    expectedContentHash: card.contentHash,
    mode: 'explicit' as const,
    placementIds: ['target', 'frontExample'],
  };
  const ordinaryPreview = await audio.prepare(card.id, ordinary);
  expect(ordinaryPreview.uncachedCharacters).toBe(0);
  const retained = await audio.generate(card.id, {
    ...ordinary,
    preflightId: ordinaryPreview.id,
  });
  expect(
    retained.items.find((clip) => clip.placementId === 'target')!.artifactKey,
  ).toBe(item.artifactKey);
  expect(synthesis()).toBe(3);
  const preview = await service.prepare({
    loadId: loaded.loadId,
    card: { id: card.id, revision: 1, contentHash: card.contentHash },
    mode: 'audio',
    placementId: 'target',
  });
  expect(preview.changes).toEqual([]);
  expect(preview.audio).toHaveLength(1);
  expect((await service.send(preview.previewId)).state).toBe('complete');
  expect(Object.keys(state.patches.at(-1)!)).toEqual(['AudioTarget']);
  for (const [key, value] of Object.entries(before))
    if (key !== 'AudioTarget') expect(state.notes[0]!.fields[key]).toBe(value);
  expect(state.media.has(before.AudioTarget!.slice(7, -1))).toBe(true);
  expect((await workspace.read()).cards[0]!.approval).not.toBe(null);
});

it('requires exact approval, source mapping, selection and a single replacement placement', async () => {
  const { service, audio, card, workspace, noteId } = await setup();
  const loaded = await service.load('2', noteId);
  await expect(
    audio.prepare(card.id, {
      expectedRevision: 1,
      expectedContentHash: card.contentHash,
      mode: 'replacement',
      placementIds: ['target', 'frontExample'],
    }),
  ).rejects.toThrow('exactly one');
  await expect(
    service.prepare({
      loadId: loaded.loadId,
      card: { id: card.id, revision: 1, contentHash: card.contentHash },
      mode: 'audio',
      placementId: 'examples:0',
    }),
  ).rejects.toThrow('Select the audio placement');
  await workspace.update(card.id, {
    expectedRevision: 1,
    fields: { ...card.fields, meaning: 'Edited.' },
    included: true,
  });
  const changed = (await workspace.read()).cards[0]!;
  await expect(
    service.prepare({
      loadId: loaded.loadId,
      card: { id: changed.id, revision: 2, contentHash: changed.contentHash },
      mode: 'content',
    }),
  ).rejects.toThrow('approval');
});

it('blocks external edits, layout/source changes and collection switches before writes', async () => {
  for (const change of [
    'content',
    'session',
    'schedule',
    'model',
    'duplicate',
  ] as const) {
    const { service, card, state, noteId } = await setup();
    const loaded = await service.load('2', noteId);
    const preview = await service.prepare({
      loadId: loaded.loadId,
      card: { id: card.id, revision: 1, contentHash: card.contentHash },
      mode: 'content',
    });
    if (change === 'content') state.notes[0]!.fields.Meaning = 'External edit';
    if (change === 'session') state.session = 'different-session';
    if (change === 'schedule') state.cardFlags = 1;
    if (change === 'model') state.model!.css = 'changed';
    if (change === 'duplicate') state.duplicates = true;
    await expect(service.send(preview.previewId)).rejects.toThrow();
    expect(state.updateCount).toBe(0);
  }
});

it('does not trust a stale or tampered legacy content snapshot', async () => {
  const { service, state, noteId } = await setup();
  state.notes[0]!.fields.AvContent = Buffer.from(
    JSON.stringify({ ...englishCoachFieldsFixture, target: 'changed' }),
  ).toString('base64');
  await expect(service.load('2', noteId)).rejects.toThrow('outside the app');
  expect(state.updateCount).toBe(0);
});

it('makes loading Anki values into a local draft explicit and clears changed-draft approval', async () => {
  const { service, workspace, noteId, edited, card } = await setup();
  const loaded = await service.load('2', noteId);
  const changed = await edited();
  expect((await workspace.read()).cards[0]!.approval).not.toBe(null);
  const restored = await service.draft(loaded.loadId, changed.revision);
  expect(restored.cards[0]!.fields).toEqual(card.fields);
  expect(restored.cards[0]!.approval).toBe(null);
  expect(restored.cards[0]!.revision).toBe(3);
});

it('reconciles a lost update response after restart without resending the patch', async () => {
  const {
    service,
    state,
    noteId,
    edited,
    directory,
    workspace,
    audio,
    client,
    delivery,
  } = await setup();
  const loaded = await service.load('2', noteId);
  const next = await edited();
  const preview = await service.prepare({
    loadId: loaded.loadId,
    card: {
      id: next.id,
      revision: next.revision,
      contentHash: next.contentHash,
    },
    mode: 'content',
  });
  state.lostUpdate = 'after';
  expect((await service.send(preview.previewId)).state).toBe('ambiguous');
  const restarted = new NoteUpdateService(
    join(directory, 'delivery'),
    delivery,
    workspace,
    audio,
    client,
  );
  expect((await restarted.status()).items[0]!.state).toBe('ambiguous');
  expect((await restarted.reconcile(preview.previewId)).state).toBe('complete');
  expect(state.updateCount).toBe(1);
  const raw = await readFile(
    join(directory, 'delivery', 'updates.json'),
    'utf8',
  );
  expect(raw).not.toContain(state.session);
});

it('requires explicit reconciliation before retrying an update not observed in Anki', async () => {
  const { service, state, noteId, edited } = await setup();
  const loaded = await service.load('2', noteId);
  const next = await edited();
  const request = {
    loadId: loaded.loadId,
    card: {
      id: next.id,
      revision: next.revision,
      contentHash: next.contentHash,
    },
    mode: 'content' as const,
  };
  const preview = await service.prepare(request);
  state.lostUpdate = 'before';
  expect((await service.send(preview.previewId)).state).toBe('ambiguous');
  await expect(service.prepare(request)).rejects.toThrow('reconciliation');
  expect((await service.reconcile(preview.previewId)).state).toBe(
    'not-applied',
  );
  const retry = await service.prepare(request);
  expect((await service.send(retry.previewId)).state).toBe('complete');
  expect(state.updateCount).toBe(1);
});

it('reports a native editor rejection as not applied and allows a newly confirmed attempt', async () => {
  const { service, state, noteId, edited } = await setup();
  const loaded = await service.load('2', noteId);
  const next = await edited();
  const card = {
    id: next.id,
    revision: next.revision,
    contentHash: next.contentHash,
  };
  const preview = await service.prepare({
    loadId: loaded.loadId,
    card,
    mode: 'content',
  });
  state.editorConflictOnUpdate = true;
  expect(await service.send(preview.previewId)).toMatchObject({
    state: 'not-applied',
    reason: expect.stringContaining('editor'),
  });
  expect(state.updateCount).toBe(0);
  state.editorConflictOnUpdate = false;
  const reload = await service.load('2', noteId);
  const retry = await service.prepare({
    loadId: reload.loadId,
    card,
    mode: 'content',
  });
  expect((await service.send(retry.previewId)).state).toBe('complete');
  expect(state.updateCount).toBe(1);
});

it('reports post-write scheduling conflicts and blocks another update', async () => {
  const { service, state, noteId, edited } = await setup();
  const loaded = await service.load('2', noteId);
  const next = await edited();
  const request = {
    loadId: loaded.loadId,
    card: {
      id: next.id,
      revision: next.revision,
      contentHash: next.contentHash,
    },
    mode: 'content' as const,
  };
  const preview = await service.prepare(request);
  state.changeCardOnUpdate = true;
  expect((await service.send(preview.previewId)).state).toBe('conflict');
  await expect(service.prepare(request)).rejects.toThrow('reconciliation');
  expect(state.updateCount).toBe(1);
});

it('rejects HTTP requests without the token, strict schema or explicit listening confirmation', async () => {
  const { service, workspace, audio, delivery, state, card, noteId } =
    await setup();
  const hosts = new Set<string>();
  const handler = createApiHandler({
    expectedHosts: hosts,
    expectedOrigins: new Set(['http://allowed.test']),
    sessionToken: 'fixture-token',
    workspace,
    audio,
    delivery,
    notes: service,
    readStatus: async () => {
      throw new Error('unused');
    },
  });
  const server = createServer((req, res) => {
    void handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  hosts.add(`127.0.0.1:${port}`);
  const url = `http://127.0.0.1:${port}/api/notes`;
  const post = (path: string, body: unknown, token = true) =>
    fetch(`${url}/${path}`, {
      method: 'POST',
      headers: {
        Origin: 'http://allowed.test',
        'Content-Type': 'application/json',
        ...(token ? { 'X-Workspace-Token': 'fixture-token' } : {}),
      },
      body: JSON.stringify(body),
    });
  try {
    expect((await post('list', { deckId: '2' }, false)).status).toBe(403);
    expect((await post('list', { deckId: '2', extra: true })).status).toBe(400);
    const listed = await post('list', { deckId: '2' });
    expect(listed.status).toBe(200);
    expect(await listed.text()).not.toContain(state.session);
    expect(
      (
        await post('send', {
          previewId: '00000000-0000-4000-8000-000000000001',
          reviewed: false,
        })
      ).status,
    ).toBe(400);
    expect(state.updateCount).toBe(0);
    expect(
      (await fetch(`${url}/media/00000000-0000-4000-8000-000000000001`)).status,
    ).toBe(404);
    expect(
      z
        .object({ items: z.array(z.unknown()) })
        .parse(await (await fetch(`${url}/status`)).json()).items,
    ).toEqual([]);
    const loaded = await service.load('2', noteId);
    const next = (
      await workspace.update(card.id, {
        expectedRevision: card.revision,
        fields: { ...card.fields, target: 'awkward moment' },
        included: true,
      })
    ).cards[0]!;
    const ref = {
      expectedRevision: next.revision,
      expectedContentHash: next.contentHash,
    };
    await workspace.approve(card.id, ref);
    await workspace.selectAudio(card.id, { ...ref, placementIds: ['target'] });
    const blocked = await post('prepare', {
      loadId: loaded.loadId,
      card: {
        id: card.id,
        revision: next.revision,
        contentHash: next.contentHash,
      },
      mode: 'content',
    });
    expect(blocked.status).toBe(400);
    expect(await blocked.json()).toMatchObject({
      error: 'update-blocked',
      message: expect.stringContaining('incomplete or stale: Target'),
    });
    expect(state.updateCount).toBe(0);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
