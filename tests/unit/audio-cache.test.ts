import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import {
  AudioCache,
  audioCacheKey,
  SpeechFailure,
} from '../../src/server/audio-cache';
import type { SpeechProvider } from '../../src/server/audio-cache';

const configuration: SpeechProvider['configuration'] = {
  providerId: 'fake',
  modelId: 'test',
  modelVersion: '1',
  voiceId: 'diagnostic',
  voiceVersion: '1',
  settings: {},
  format: 'wav',
};
function wave() {
  const bytes = Buffer.alloc(46);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(38, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24);
  bytes.writeUInt32LE(16000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(2, 40);
  return bytes;
}
const folders: string[] = [];
afterEach(async () => {
  await Promise.all(
    folders.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), 'anki-audio-cache-'));
  folders.push(directory);
  return { directory, cache: new AudioCache(directory) };
}

it('keys exact text and every voice configuration while canonicalizing setting order', () => {
  const original = audioCacheKey('Hello.', configuration);
  expect(audioCacheKey('hello.', configuration)).not.toBe(original);
  for (const override of [
    { voiceId: 'other' },
    { modelVersion: '2' },
    { format: 'mp3' as const },
    { settings: { speed: 1 } },
  ]) {
    expect(audioCacheKey('Hello.', { ...configuration, ...override })).not.toBe(
      original,
    );
  }
  expect(
    audioCacheKey('Hello.', { ...configuration, settings: { a: 1, b: 2 } }),
  ).toBe(
    audioCacheKey('Hello.', { ...configuration, settings: { b: 2, a: 1 } }),
  );
});

it('deduplicates concurrent requests and recovers exact media after restart', async () => {
  const { directory, cache } = await setup();
  let calls = 0;
  const provider: SpeechProvider = {
    configuration,
    synthesize: async () => {
      calls++;
      return wave();
    },
  };
  const [first, second] = await Promise.all([
    cache.generate('Hello.', provider),
    cache.generate('Hello.', provider),
  ]);
  expect(first).toEqual(second);
  expect(calls).toBe(1);
  const restarted = new AudioCache(directory);
  expect(await restarted.generate('Hello.', provider)).toEqual(first);
  expect(calls).toBe(1);
  expect((await restarted.read(first.key))?.bytes).toEqual(wave());
  await writeFile(join(directory, `${first.key}.wav`), Buffer.alloc(46));
  await expect(restarted.read(first.key)).rejects.toThrow('integrity');
});

it('preserves successes on partial failure, resumes without repeating them, and pauses on quota', async () => {
  const { cache } = await setup();
  const calls: string[] = [];
  let fail = true;
  const provider: SpeechProvider = {
    configuration,
    synthesize: async (text) => {
      calls.push(text);
      if (text === 'Two' && fail) throw new Error('private-provider-error');
      return wave();
    },
  };
  expect(
    (await cache.batch(['One', 'Two', 'Three'], provider)).map(
      (item) => item.state,
    ),
  ).toEqual(['complete', 'failed', 'complete']);
  fail = false;
  expect(
    (await cache.batch(['One', 'Two', 'Three'], provider)).map(
      (item) => item.state,
    ),
  ).toEqual(['complete', 'complete', 'complete']);
  expect(calls).toEqual(['One', 'Two', 'Three', 'Two']);
  const quota: SpeechProvider = {
    configuration,
    synthesize: async () => {
      throw new SpeechFailure('quota');
    },
  };
  expect(await cache.batch(['Four', 'Five'], quota)).toEqual([
    { state: 'failed', reason: 'quota' },
    { state: 'paused', reason: 'quota' },
  ]);
  const invalid: SpeechProvider = {
    configuration,
    synthesize: async () => Buffer.from('unexpected JSON response'),
  };
  await expect(cache.generate('Six', invalid)).rejects.toThrow(
    'Invalid speech media',
  );
  await expect(cache.read('../escape')).rejects.toThrow('Invalid artifact');
});
