import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { speechConfigurationSchema } from '../shared/contracts/speech';
import type { SpeechConfiguration } from '../shared/contracts/speech';

const recordSchema = z.strictObject({
  version: z.literal(1),
  key: z.string().regex(/^[a-f0-9]{64}$/),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive().max(20_000_000),
  format: z.enum(['mp3', 'wav']),
});
export type CachedAudio = z.infer<typeof recordSchema>;
export class AudioIntegrityError extends Error {}

export interface SpeechProvider {
  readonly configuration: SpeechConfiguration;
  synthesize(text: string): Promise<Uint8Array>;
}

export class SpeechFailure extends Error {
  constructor(readonly kind: 'quota' | 'temporary' | 'configuration') {
    super(`Speech provider failure: ${kind}`);
  }
}

function checksum(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function audioCacheKey(
  text: string,
  input: SpeechConfiguration,
): string {
  if (!text.trim()) throw new Error('Empty speech text.');
  const configuration = speechConfigurationSchema.parse(input);
  return checksum(
    Buffer.from(
      JSON.stringify({
        text,
        ...configuration,
        settings: Object.fromEntries(
          Object.entries(configuration.settings).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
        ),
      }),
    ),
  );
}

function validateAudio(bytes: Uint8Array, format: 'mp3' | 'wav'): void {
  const data = Buffer.from(bytes);
  const supported =
    format === 'wav'
      ? data.length >= 44 &&
        data.toString('ascii', 0, 4) === 'RIFF' &&
        data.toString('ascii', 8, 12) === 'WAVE'
      : data.length >= 4 &&
        (data.toString('ascii', 0, 3) === 'ID3' ||
          (data[0] === 0xff && (data[1]! & 0xe0) === 0xe0));
  if (!supported || data.length > 20_000_000)
    throw new Error('Invalid speech media response.');
}

/** Server-only artifact cache. Call generation inside WorkspaceStore.withApprovedCard. */
export class AudioCache {
  private readonly pending = new Map<string, Promise<CachedAudio>>();
  constructor(private readonly directory: string) {}

  async read(
    key: string,
  ): Promise<{ record: CachedAudio; bytes: Uint8Array } | null> {
    if (!/^[a-f0-9]{64}$/.test(key))
      throw new Error('Invalid artifact identity.');
    let raw: string;
    try {
      raw = await readFile(join(this.directory, `${key}.json`), 'utf8');
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      )
        return null;
      throw error;
    }
    let record: CachedAudio;
    try {
      record = recordSchema.parse(JSON.parse(raw));
    } catch {
      throw new AudioIntegrityError('Artifact metadata integrity failure.');
    }
    if (record.key !== key)
      throw new AudioIntegrityError('Artifact identity mismatch.');
    let bytes: Buffer;
    try {
      bytes = await readFile(join(this.directory, `${key}.${record.format}`));
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      )
        return null;
      throw error;
    }
    if (bytes.length !== record.bytes || checksum(bytes) !== record.checksum)
      throw new AudioIntegrityError('Artifact integrity failure.');
    try {
      validateAudio(bytes, record.format);
    } catch {
      throw new AudioIntegrityError('Artifact media integrity failure.');
    }
    return { record, bytes };
  }

  async generate(text: string, provider: SpeechProvider): Promise<CachedAudio> {
    const configuration = speechConfigurationSchema.parse(
      provider.configuration,
    );
    const key = audioCacheKey(text, configuration);
    const existing = this.pending.get(key);
    if (existing) return existing;
    const operation = (async () => {
      let cached;
      try {
        cached = await this.read(key);
      } catch (error) {
        if (!(error instanceof AudioIntegrityError)) throw error;
      }
      if (cached) return cached.record;
      const bytes = await provider.synthesize(text);
      validateAudio(bytes, configuration.format);
      const record = recordSchema.parse({
        version: 1,
        key,
        checksum: checksum(bytes),
        bytes: bytes.length,
        format: configuration.format,
      });
      await mkdir(this.directory, { recursive: true });
      await this.atomicWrite(`${key}.${configuration.format}`, bytes);
      // Metadata commits last; an interrupted media write is never a cache hit.
      await this.atomicWrite(
        `${key}.json`,
        Buffer.from(JSON.stringify(record)),
      );
      return record;
    })();
    this.pending.set(key, operation);
    try {
      return await operation;
    } finally {
      this.pending.delete(key);
    }
  }

  async batch(texts: readonly string[], provider: SpeechProvider) {
    const results: (
      | { state: 'complete'; artifact: CachedAudio }
      | { state: 'failed' | 'paused'; reason: string }
    )[] = [];
    let paused = false;
    for (const text of texts) {
      if (paused) {
        results.push({ state: 'paused', reason: 'quota' });
        continue;
      }
      try {
        results.push({
          state: 'complete',
          artifact: await this.generate(text, provider),
        });
      } catch (error) {
        const reason =
          error instanceof SpeechFailure ? error.kind : 'generation-or-storage';
        results.push({ state: 'failed', reason });
        paused = reason === 'quota';
      }
    }
    return results;
  }

  private async atomicWrite(name: string, bytes: Uint8Array): Promise<void> {
    const temporary = join(this.directory, `${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, bytes, { flag: 'wx' });
      await rename(temporary, join(this.directory, name));
    } finally {
      await rm(temporary, { force: true });
    }
  }
}
