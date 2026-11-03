import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it } from 'vitest';
import { AudioService } from '../../src/server/audio-service';
import { SpeechFailure } from '../../src/server/audio-cache';
import type { SpeechProvider } from '../../src/server/audio-cache';
import { WorkspaceStore } from '../../src/server/workspace';
import { previewImport } from '../../src/server/card-import';
import { createApiHandler } from '../../src/server/http';
import { hasBlockingAudioFailure } from '../../src/shared/audio-generation';
import { englishCoachFieldsFixture } from '../../src/shared/fixtures/workflow';

const folders: string[] = [];
afterEach(async () => {
  await Promise.all(
    folders
      .splice(0)
      .map((folder) => rm(folder, { recursive: true, force: true })),
  );
});
const configuration: SpeechProvider['configuration'] = {
  providerId: 'fake',
  modelId: 'test',
  modelVersion: '1',
  voiceId: 'test',
  voiceVersion: '1',
  settings: {},
  format: 'wav',
};
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
async function setup(
  synthesize: SpeechProvider['synthesize'] = async () => wave(),
) {
  const directory = await mkdtemp(join(tmpdir(), 'anki-audio-service-'));
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
  const provider = { configuration, synthesize };
  const allowance = async () => ({
    tier: 'free',
    used: 0,
    limit: 10000,
    canExtend: false,
  });
  const service = new AudioService(
    join(directory, 'audio'),
    workspace,
    provider,
    allowance,
    'Fake voice',
  );
  const input = {
    expectedRevision: card.revision,
    expectedContentHash: card.contentHash,
    placementIds: ['target', 'frontExample'],
    mode: 'explicit' as const,
  };
  return { directory, workspace, card, provider, allowance, service, input };
}

it('rejects unapproved, stale, tampered and unpreviewed generation commands', async () => {
  let calls = 0;
  const { service, workspace, card, input } = await setup(async () => {
    calls++;
    return wave();
  });
  await expect(service.prepare(card.id, input)).rejects.toThrow('approval');
  await workspace.approve(card.id, input);
  await expect(
    service.generate(card.id, {
      ...input,
      preflightId: '00000000-0000-4000-8000-000000000000',
    }),
  ).rejects.toThrow('expired');
  const preview = await service.prepare(card.id, input);
  await expect(
    service.generate(card.id, {
      ...input,
      placementIds: ['examples:0'],
      preflightId: preview.id,
    }),
  ).rejects.toThrow('expired');
  await workspace.update(card.id, {
    expectedRevision: 1,
    included: true,
    fields: { ...card.fields, meaning: 'Changed.' },
  });
  await expect(
    service.generate(card.id, { ...input, preflightId: preview.id }),
  ).rejects.toThrow('Stale');
  expect(calls).toBe(0);
});

it('persists successful clips, replays idempotently, and compares stale audio after editing', async () => {
  let calls = 0;
  const { directory, service, workspace, card, input, provider, allowance } =
    await setup(async () => {
      calls++;
      return wave();
    });
  await workspace.approve(card.id, input);
  const preview = await service.prepare(card.id, input);
  const result = await service.generate(card.id, {
    ...input,
    preflightId: preview.id,
  });
  expect(result.items.slice(0, 2).map((item) => item.audioState)).toEqual([
    'complete',
    'complete',
  ]);
  await service.generate(card.id, { ...input, preflightId: preview.id });
  expect(calls).toBe(2);
  const exhausted = new AudioService(
    join(directory, 'audio'),
    workspace,
    provider,
    async () => ({ tier: 'free', used: 10000, limit: 10000, canExtend: false }),
  );
  const reused = await exhausted.prepare(card.id, input);
  expect(reused.uncachedCharacters).toBe(0);
  await exhausted.generate(card.id, { ...input, preflightId: reused.id });
  expect(calls).toBe(2);
  const restarted = new AudioService(
    join(directory, 'audio'),
    new WorkspaceStore(directory),
    provider,
    allowance,
  );
  const offline = new AudioService(
    join(directory, 'audio'),
    new WorkspaceStore(directory),
    null,
    async () => {
      throw new Error('No provider calls allowed');
    },
  );
  const recoveredOffline = await offline.review(card.id, 1, card.contentHash);
  expect(recoveredOffline.configuration).toBeNull();
  expect(recoveredOffline.items[0]?.audioState).toBe('complete');
  expect(
    (await offline.media(recoveredOffline.items[0]!.artifactKey!))?.bytes,
  ).toEqual(wave());
  expect((await restarted.media(result.items[0]!.artifactKey!))?.bytes).toEqual(
    wave(),
  );
  expect(await restarted.media('0'.repeat(64))).toBeNull();
  const changed = (
    await workspace.update(card.id, {
      expectedRevision: 1,
      included: true,
      fields: { ...card.fields, target: 'uneasy' },
    })
  ).cards[0]!;
  await workspace.approve(card.id, {
    expectedRevision: 2,
    expectedContentHash: changed.contentHash,
  });
  expect(
    (await restarted.review(card.id, 2, changed.contentHash)).items[0]
      ?.audioState,
  ).toBe('stale');
  const nextInput = {
    ...input,
    expectedRevision: 2,
    expectedContentHash: changed.contentHash,
  };
  const next = await restarted.prepare(card.id, nextInput);
  const generated = await restarted.generate(card.id, {
    ...nextInput,
    preflightId: next.id,
  });
  expect(calls).toBe(3); // unchanged front sentence reuses exact cached audio
  expect(generated.items[0]?.previousKey).toBe(result.items[0]?.artifactKey);
});

it('recovers deleted or corrupt media through an explicit retry', async () => {
  let calls = 0;
  const { service, workspace, card, input, directory } = await setup(
    async () => {
      calls++;
      return wave();
    },
  );
  await workspace.approve(card.id, input);
  const request = { ...input, placementIds: ['target'] };
  const preview = await service.prepare(card.id, request);
  const result = await service.generate(card.id, {
    ...request,
    preflightId: preview.id,
  });
  const path = join(
    directory,
    'audio',
    'artifacts',
    `${result.items[0]!.artifactKey}.wav`,
  );
  for (const corrupt of [false, true]) {
    if (corrupt) await writeFile(path, Buffer.alloc(46));
    else await rm(path);
    expect(
      (await service.review(card.id, 1, card.contentHash)).items[0]?.audioState,
    ).toBe('failed');
    const retry = await service.prepare(card.id, request);
    const recovered = await service.generate(card.id, {
      ...request,
      preflightId: retry.id,
    });
    expect(recovered.items[0]?.audioState).toBe('complete');
    expect(
      (await service.media(recovered.items[0]!.artifactKey!))?.bytes,
    ).toEqual(wave());
  }
  expect(calls).toBe(3);
});

it('counts identical uncached text once while retaining both placements', async () => {
  let calls = 0;
  const { directory, workspace, card, input, provider } = await setup(
    async () => {
      calls++;
      return wave();
    },
  );
  const changed = (
    await workspace.update(card.id, {
      expectedRevision: 1,
      included: true,
      fields: { ...card.fields, frontExample: card.fields.target },
    })
  ).cards[0]!;
  const request = {
    ...input,
    expectedRevision: 2,
    expectedContentHash: changed.contentHash,
  };
  await workspace.approve(card.id, request);
  const service = new AudioService(
    join(directory, 'audio'),
    workspace,
    provider,
    async () => ({ tier: 'free', used: 0, limit: 7, canExtend: false }),
  );
  const preview = await service.prepare(card.id, request);
  expect(preview.clipCount).toBe(2);
  expect(preview.characterCount).toBe(14);
  expect(preview.uncachedCharacters).toBe(7);
  const result = await service.generate(card.id, {
    ...request,
    preflightId: preview.id,
  });
  expect(calls).toBe(1);
  expect(result.items[0]?.artifactKey).toBe(result.items[1]?.artifactKey);
});

it('protects HTTP generation requests and serves only registered artifact bytes', async () => {
  const { service, workspace, card, input } = await setup();
  await workspace.approve(card.id, input);
  const hosts = new Set<string>();
  const handler = createApiHandler({
    expectedHosts: hosts,
    expectedOrigins: new Set(['http://allowed.test']),
    readStatus: async () => ({
      server: { status: 'ready' },
      anki: { status: 'unavailable', reason: 'not-running-or-unreachable' },
    }),
    workspace,
    audio: service,
    sessionToken: 'fake-session',
  });
  const server = createServer((request, response) => {
    void handler(request, response);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  hosts.add(`127.0.0.1:${port}`);
  const base = `http://127.0.0.1:${port}`;
  const headers = {
    Origin: 'http://allowed.test',
    'Content-Type': 'application/json',
    'X-Workspace-Token': 'fake-session',
  };
  const post = (path: string, body: unknown, authorized = true) =>
    fetch(`${base}/api/cards/${card.id}/${path}`, {
      method: 'POST',
      headers: authorized ? headers : { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  try {
    expect((await post('audio-prepare', input, false)).status).toBe(403);
    expect(
      (await post('audio-prepare', { ...input, unexpected: true })).status,
    ).toBe(400);
    expect(
      (await post('audio-prepare', { ...input, expectedRevision: 2 })).status,
    ).toBe(409);
    const previewResponse = await post('audio-prepare', input);
    expect(previewResponse.status).toBe(200);
    const preview = (await previewResponse.json()) as { id: string };
    const generatedResponse = await post('audio-generate', {
      ...input,
      preflightId: preview.id,
    });
    expect(generatedResponse.status).toBe(200);
    const generated = (await generatedResponse.json()) as {
      items: { artifactKey: string }[];
    };
    const media = await fetch(
      `${base}/api/audio/${generated.items[0]!.artifactKey}`,
    );
    expect(media.headers.get('content-type')).toBe('audio/wav');
    expect(Buffer.from(await media.arrayBuffer())).toEqual(wave());
    expect((await fetch(`${base}/api/audio/${'0'.repeat(64)}`)).status).toBe(
      404,
    );
    expect(
      (
        await fetch(`${base}/api/audio/${generated.items[0]!.artifactKey}`, {
          method: 'POST',
        })
      ).status,
    ).toBe(405);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

it('preserves completed items and pauses remaining work after a quota response', async () => {
  let calls = 0;
  const { service, workspace, card, input } = await setup(async () => {
    if (++calls === 2) throw new SpeechFailure('quota');
    return wave();
  });
  await workspace.approve(card.id, input);
  const request = { ...input, mode: 'missing' as const, placementIds: [] };
  const preview = await service.prepare(card.id, request);
  const result = await service.generate(card.id, {
    ...request,
    preflightId: preview.id,
  });
  expect(result.items.map((item) => item.audioState)).toEqual([
    'complete',
    'failed',
    'paused',
    'paused',
    'paused',
    'paused',
  ]);
  const targetRequest = { ...input, placementIds: ['target'] };
  const targetPreview = await service.prepare(card.id, targetRequest);
  const targetResult = await service.generate(card.id, {
    ...targetRequest,
    preflightId: targetPreview.id,
  });
  expect(hasBlockingAudioFailure(targetResult, targetRequest)).toBe(false);
  expect(hasBlockingAudioFailure(result, request)).toBe(true);
  const retry = await service.prepare(card.id, request);
  await service.generate(card.id, { ...request, preflightId: retry.id });
  expect(calls).toBe(7);
});
