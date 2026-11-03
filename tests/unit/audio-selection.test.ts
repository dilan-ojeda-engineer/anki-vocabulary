import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createEnglishCoachProfile } from '../../src/profiles/english-coach';
import { previewImport } from '../../src/server/card-import';
import { createApiHandler } from '../../src/server/http';
import { WorkspaceStore } from '../../src/server/workspace';
import { extractAudioItems } from '../../src/shared/audio-plan';
import { englishCoachFieldsFixture } from '../../src/shared/fixtures/workflow';

const fields = {
  ...englishCoachFieldsFixture,
  spanishPronunciation: 'Stress the first syllable and avoid a final vowel.',
  examples: [...englishCoachFieldsFixture.examples, 'The timing felt awkward.'],
};
const folders: string[] = [];
const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  await Promise.all(
    folders
      .splice(0)
      .map((folder) => rm(folder, { recursive: true, force: true })),
  );
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
  );
});

async function setup(inputFields: Record<string, unknown> = fields) {
  const directory = await mkdtemp(join(tmpdir(), 'anki-audio-selection-'));
  folders.push(directory);
  const store = new WorkspaceStore(directory);
  const saved = await store.add(
    previewImport({ format: 'json', text: JSON.stringify([inputFields]) }),
    [1],
  );
  return { directory, store, card: saved.cards[0]! };
}

describe('AV-032 audio extraction and selection', () => {
  it('extracts only the target, front example, and each additional example', () => {
    const items = extractAudioItems(fields);
    expect(items.map((item) => item.placementId)).toEqual([
      'target',
      'frontExample',
      'examples:0',
      'examples:1',
      'examples:2',
      'examples:3',
    ]);
    expect(items.map((item) => item.text)).toEqual([
      fields.target,
      fields.frontExample,
      ...fields.examples,
    ]);
    expect(items.map((item) => item.side)).toEqual([
      'front',
      'front',
      'back',
      'back',
      'back',
      'back',
    ]);
    expect(items.every((item) => item.status === 'missing')).toBe(true);
    expect(items.map((item) => item.characterCount)).toEqual(
      items.map((item) => [...item.text].length),
    );
    expect(items.some((item) => item.text.includes('Incómodo'))).toBe(false);
    expect(items.some((item) => item.text.includes('Stress the first'))).toBe(
      false,
    );
    const marked = extractAudioItems({
      ...fields,
      frontExample: '“I felt **awkward** asking for help.”',
    })[1]!;
    expect(marked.sourceText).toBe('“I felt **awkward** asking for help.”');
    expect(marked.text).toBe(fields.frontExample);
    const spaced = extractAudioItems({
      ...fields,
      frontExample: '“  I felt awkward asking for help.  ”',
    })[1]!;
    expect(spaced.text).toBe(fields.frontExample);
    expect(
      createEnglishCoachProfile('fixture').audioSelectors.map(
        (item) => item.fieldKey,
      ),
    ).toEqual(['target', 'frontExample', 'examples']);
    expect(
      createEnglishCoachProfile('fixture', 'av005-1').audioSelectors.map(
        (item) => item.fieldKey,
      ),
    ).toEqual(['frontExample', 'examples']);
  });

  it('shows a single invalid speech item without hiding the other placements', async () => {
    const { store, card } = await setup({ ...fields, target: '**' });
    await store.approve(card.id, {
      expectedRevision: 1,
      expectedContentHash: card.contentHash,
    });
    const plan = await store.audioPlan(card.id, 1, card.contentHash);
    expect(plan.items).toHaveLength(6);
    expect(plan.items[0]).toMatchObject({
      sourceText: '**',
      text: '',
      characterCount: 0,
      status: 'invalid',
    });
    expect(plan.items.slice(1).every((item) => item.status === 'missing')).toBe(
      true,
    );
    await expect(
      store.selectAudio(card.id, {
        expectedRevision: 1,
        expectedContentHash: card.contentHash,
        placementIds: ['target'],
      }),
    ).rejects.toThrow('Invalid audio placement');
    expect(
      (
        await store.selectAudio(card.id, {
          expectedRevision: 1,
          expectedContentHash: card.contentHash,
          placementIds: ['frontExample'],
        })
      ).cards[0]?.audioSelection?.placementIds,
    ).toEqual(['frontExample']);
  });

  it('requires exact approval and persists one, several, and all selections', async () => {
    const { directory, store, card } = await setup();
    const request = {
      expectedRevision: card.revision,
      expectedContentHash: card.contentHash,
    };
    await expect(store.audioPlan(card.id, 1, card.contentHash)).rejects.toThrow(
      'requires approval',
    );
    await expect(
      store.selectAudio(card.id, { ...request, placementIds: ['target'] }),
    ).rejects.toThrow('requires approval');
    await store.approve(card.id, request);
    expect(
      (await store.audioPlan(card.id, 1, card.contentHash)).items,
    ).toHaveLength(6);
    const one = await store.selectAudio(card.id, {
      ...request,
      placementIds: ['target'],
    });
    expect(one.cards[0]?.audioSelection?.placementIds).toEqual(['target']);
    const several = await store.selectAudio(card.id, {
      ...request,
      placementIds: ['examples:2', 'frontExample', 'target'],
    });
    expect(several.cards[0]?.audioSelection?.placementIds).toEqual([
      'target',
      'frontExample',
      'examples:2',
    ]);
    const allIds = (
      await store.audioPlan(card.id, 1, card.contentHash)
    ).items.map((item) => item.placementId);
    await store.selectAudio(card.id, { ...request, placementIds: allIds });
    expect(
      (await new WorkspaceStore(directory).read()).cards[0]?.audioSelection
        ?.placementIds,
    ).toEqual(allIds);
    await expect(
      store.selectAudio(card.id, { ...request, placementIds: ['meaning'] }),
    ).rejects.toThrow('Invalid audio placement');
    await expect(
      store.selectAudio(card.id, {
        ...request,
        placementIds: ['target', 'target'],
      }),
    ).rejects.toThrow('Invalid audio placement');
    await expect(store.audioPlan(card.id, 2, card.contentHash)).rejects.toThrow(
      'Stale',
    );
    await expect(
      store.selectAudio(card.id, {
        ...request,
        expectedContentHash: '0'.repeat(64),
        placementIds: ['target'],
      }),
    ).rejects.toThrow('Stale');
    const edited = await store.update(card.id, {
      expectedRevision: 1,
      fields: { ...card.fields, meaning: 'Changed meaning.' },
      included: true,
    });
    expect(edited.cards[0]?.approval).toBeNull();
    expect(edited.cards[0]?.audioSelection).toBeNull();
    await expect(
      store.audioPlan(card.id, 2, edited.cards[0]!.contentHash),
    ).rejects.toThrow('requires approval');
  });

  it('migrates an approved version-3 workspace without inventing a selection', async () => {
    const { directory, store, card } = await setup();
    const approved = (
      await store.approve(card.id, {
        expectedRevision: 1,
        expectedContentHash: card.contentHash,
      })
    ).cards[0]!;
    const oldCard = { ...approved };
    delete (oldCard as Partial<typeof approved>).audioSelection;
    const old = { version: 3, cards: [oldCard] };
    const path = join(directory, 'workspace.json');
    await writeFile(path, JSON.stringify(old));
    const recovered = await new WorkspaceStore(directory).read();
    expect(recovered.version).toBe(4);
    expect(recovered.cards[0]?.approval).toEqual(approved.approval);
    expect(recovered.cards[0]?.audioSelection).toBeNull();
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(old);
  });

  it('enforces origin/session and stale revision at the HTTP boundary', async () => {
    const { store, card } = await setup();
    const expectedHosts = new Set<string>();
    const handler = createApiHandler({
      expectedHosts,
      expectedOrigins: new Set(['http://allowed.test']),
      readStatus: async () => ({
        server: { status: 'ready' },
        anki: { status: 'unavailable', reason: 'not-running-or-unreachable' },
      }),
      workspace: store,
      sessionToken: 'test-token',
    });
    const server = createServer((request, response) => {
      void handler(request, response);
    });
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const address = server.address() as AddressInfo;
    expectedHosts.add(`127.0.0.1:${address.port}`);
    const base = `http://127.0.0.1:${address.port}/api/cards/${card.id}`;
    const body = JSON.stringify({
      expectedRevision: 1,
      expectedContentHash: card.contentHash,
    });
    const headers = {
      origin: 'http://allowed.test',
      'content-type': 'application/json',
      'x-workspace-token': 'test-token',
    };
    expect(
      (
        await fetch(`${base}/audio-plan`, {
          method: 'POST',
          body,
          headers: { ...headers, 'x-workspace-token': '' },
        })
      ).status,
    ).toBe(403);
    expect(
      (await fetch(`${base}/audio-plan`, { method: 'POST', body, headers }))
        .status,
    ).toBe(400);
    await store.approve(card.id, {
      expectedRevision: 1,
      expectedContentHash: card.contentHash,
    });
    expect(
      (await fetch(`${base}/audio-plan`, { method: 'POST', body, headers }))
        .status,
    ).toBe(200);
    expect(
      (
        await fetch(`${base}/audio-selection`, {
          method: 'POST',
          body: JSON.stringify({
            ...(JSON.parse(body) as object),
            placementIds: ['meaning'],
          }),
          headers,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(`${base}/audio-selection`, {
          method: 'POST',
          body: JSON.stringify({
            ...(JSON.parse(body) as object),
            placementIds: ['target'],
          }),
          headers,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await fetch(`${base}/audio-plan`, {
          method: 'POST',
          body: JSON.stringify({
            expectedRevision: 2,
            expectedContentHash: card.contentHash,
          }),
          headers,
        })
      ).status,
    ).toBe(409);
  });
});
