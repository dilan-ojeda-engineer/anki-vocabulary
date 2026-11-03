import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { previewImport } from '../../src/server/card-import';
import { createApiHandler } from '../../src/server/http';
import {
  contentHash,
  requireApprovedCard,
  WorkspaceStore,
} from '../../src/server/workspace';
import { englishCoachFieldsFixture } from '../../src/shared/fixtures/workflow';

const folders: string[] = [];
const servers: ReturnType<typeof createServer>[] = [];
const fields = {
  ...englishCoachFieldsFixture,
  examples: [...englishCoachFieldsFixture.examples, 'The timing felt awkward.'],
};
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

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), 'anki-approval-'));
  folders.push(directory);
  const store = new WorkspaceStore(directory);
  const workspace = await store.add(
    previewImport({
      format: 'json',
      text: JSON.stringify([fields]),
    }),
    [1],
  );
  return { directory, store, card: workspace.cards[0]! };
}

describe('AV-031 server-owned exact-revision approval', () => {
  it('hashes complete valid content deterministically and rejects invalid fields', () => {
    expect(contentHash(fields)).toBe(
      contentHash(Object.fromEntries(Object.entries(fields).reverse())),
    );
    expect(contentHash({ ...fields, meaning: 'Changed meaning.' })).not.toBe(
      contentHash(fields),
    );
    expect(
      contentHash({ ...fields, examples: [...fields.examples].reverse() }),
    ).not.toBe(contentHash(fields));
    expect(() => contentHash({ ...fields, examples: [] })).toThrow();
  });

  it('persists approval, replays idempotently, and rejects tampered or stale requests', async () => {
    const { directory, store, card } = await setup();
    await expect(
      store.withApprovedCard(
        card.id,
        card.revision,
        card.contentHash,
        (valid) => valid,
      ),
    ).rejects.toThrow('requires approval');
    await expect(
      store.approve(card.id, {
        expectedRevision: card.revision,
        expectedContentHash: '0'.repeat(64),
      }),
    ).rejects.toThrow('Stale');
    const approved = (
      await store.approve(card.id, {
        expectedRevision: card.revision,
        expectedContentHash: card.contentHash,
      })
    ).cards[0]!;
    expect(approved.approval).toMatchObject({
      revision: card.revision,
      contentHash: card.contentHash,
    });
    expect(
      (
        await store.approve(card.id, {
          expectedRevision: card.revision,
          expectedContentHash: card.contentHash,
        })
      ).cards[0]?.approval,
    ).toEqual(approved.approval);
    expect(
      await new WorkspaceStore(directory).withApprovedCard(
        card.id,
        card.revision,
        card.contentHash,
        (valid) => valid,
      ),
    ).toEqual(approved);
    await expect(
      store.withApprovedCard(
        card.id,
        card.revision + 1,
        card.contentHash,
        (valid) => valid,
      ),
    ).rejects.toThrow('Stale');
    await expect(
      store.withApprovedCard(
        card.id,
        card.revision,
        '0'.repeat(64),
        (valid) => valid,
      ),
    ).rejects.toThrow('Stale');
    expect(() =>
      requireApprovedCard({
        ...approved,
        fields: { ...approved.fields, meaning: 'Tampered meaning.' },
      }),
    ).toThrow('requires approval');

    const file = join(directory, 'workspace.json');
    const persisted = JSON.parse(await readFile(file, 'utf8')) as {
      cards: { fields: Record<string, unknown> }[];
    };
    persisted.cards[0]!.fields.meaning = 'Tampered on disk.';
    await writeFile(file, JSON.stringify(persisted));
    await expect(new WorkspaceStore(directory).read()).rejects.toThrow(
      'content hash does not match',
    );
  });

  it('clears approval on edits, inclusion changes, and content reversion', async () => {
    const { store, card } = await setup();
    await store.approve(card.id, {
      expectedRevision: card.revision,
      expectedContentHash: card.contentHash,
    });
    const changed = (
      await store.update(card.id, {
        expectedRevision: 1,
        fields: { ...card.fields, meaning: 'Changed meaning.' },
        included: true,
      })
    ).cards[0]!;
    expect(changed.revision).toBe(2);
    expect(changed.approval).toBeNull();
    await expect(
      store.withApprovedCard(
        card.id,
        changed.revision,
        changed.contentHash,
        (valid) => valid,
      ),
    ).rejects.toThrow('requires approval');
    await expect(
      store.approve(card.id, {
        expectedRevision: 1,
        expectedContentHash: card.contentHash,
      }),
    ).rejects.toThrow('Stale');
    const reverted = (
      await store.update(card.id, {
        expectedRevision: 2,
        fields: card.fields,
        included: true,
      })
    ).cards[0]!;
    expect(reverted.contentHash).toBe(card.contentHash);
    expect(reverted.revision).toBe(3);
    expect(reverted.approval).toBeNull();
    const excluded = (
      await store.update(card.id, {
        expectedRevision: 3,
        fields: card.fields,
        included: false,
      })
    ).cards[0]!;
    await expect(
      store.approve(card.id, {
        expectedRevision: excluded.revision,
        expectedContentHash: excluded.contentHash,
      }),
    ).rejects.toThrow('Excluded');
    await expect(
      store.withApprovedCard(
        card.id,
        excluded.revision,
        excluded.contentHash,
        (valid) => valid,
      ),
    ).rejects.toThrow('requires approval');
  });

  it('keeps an approved action and an edit in one serialized boundary', async () => {
    const { store, card } = await setup();
    await store.approve(card.id, {
      expectedRevision: 1,
      expectedContentHash: card.contentHash,
    });
    let release: (() => void) | undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const action = store.withApprovedCard(
      card.id,
      1,
      card.contentHash,
      async () => {
        entered?.();
        await hold;
        return 'completed';
      },
    );
    await started;
    const edit = store.update(card.id, {
      expectedRevision: 1,
      fields: { ...card.fields, meaning: 'A new meaning.' },
      included: true,
    });
    expect((await store.read()).cards[0]?.revision).toBe(1);
    release?.();
    expect(await action).toBe('completed');
    expect((await edit).cards[0]?.approval).toBeNull();
    await expect(
      store.withApprovedCard(card.id, 1, card.contentHash, (valid) => valid),
    ).rejects.toThrow('Stale');
  });

  it('migrates a version-2 workspace without inventing approval', async () => {
    const { directory, card } = await setup();
    const file = join(directory, 'workspace.json');
    const oldCard = { ...card };
    delete (oldCard as Partial<typeof card>).contentHash;
    delete (oldCard as Partial<typeof card>).approval;
    const old = { version: 2, cards: [oldCard] };
    await writeFile(file, JSON.stringify(old));
    const migrated = await new WorkspaceStore(directory).read();
    expect(migrated.cards[0]).toMatchObject({
      id: card.id,
      revision: card.revision,
      contentHash: card.contentHash,
      approval: null,
    });
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(old);
  });

  it('requires a trusted local mutation request and returns a stale conflict', async () => {
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
    const url = `http://127.0.0.1:${address.port}/api/cards/${card.id}/approval`;
    const body = JSON.stringify({
      expectedRevision: card.revision,
      expectedContentHash: card.contentHash,
    });
    const headers = {
      origin: 'http://allowed.test',
      'content-type': 'application/json',
    };
    expect((await fetch(url, { method: 'POST', headers, body })).status).toBe(
      403,
    );
    expect(
      (
        await fetch(url, {
          method: 'POST',
          headers: { ...headers, 'x-workspace-token': 'test-token' },
          body: JSON.stringify({
            expectedRevision: card.revision,
            expectedContentHash: '0'.repeat(64),
          }),
        })
      ).status,
    ).toBe(409);
    const accepted = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'x-workspace-token': 'test-token' },
      body,
    });
    expect(accepted.status).toBe(200);
    expect((await store.read()).cards[0]?.approval?.revision).toBe(1);
  });
});
