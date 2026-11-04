import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { speechKeySchema } from '../shared/speech-settings';
import { z } from 'zod';

const payloadSchema = z.strictObject({
  version: z.literal(1),
  key: speechKeySchema.nullable(),
});

export interface SecretProtection {
  readonly available: boolean;
  encrypt(bytes: Uint8Array): Uint8Array;
  decrypt(bytes: Uint8Array): Uint8Array;
}

export async function windowsSecretProtection(): Promise<SecretProtection> {
  try {
    const { Dpapi, isPlatformSupported } = await import('@primno/dpapi');
    return {
      available: isPlatformSupported,
      encrypt: (bytes) => Dpapi.protectData(bytes, null, 'CurrentUser'),
      decrypt: (bytes) => Dpapi.unprotectData(bytes, null, 'CurrentUser'),
    };
  } catch {
    return {
      available: false,
      encrypt: () => {
        throw new Error('Encryption unavailable.');
      },
      decrypt: () => {
        throw new Error('Encryption unavailable.');
      },
    };
  }
}

/** Separate from the workspace/media directory; never included in workspace exports. */
export class CredentialStore {
  constructor(
    private readonly directory: string,
    private readonly protection: SecretProtection,
  ) {}
  get available() {
    return this.protection.available;
  }
  private get path() {
    return join(this.directory, 'elevenlabs.dpapi');
  }
  async read(): Promise<string | null> {
    return (await this.load()).key;
  }
  async load(): Promise<{ key: string | null; present: boolean }> {
    let encrypted: Buffer;
    try {
      encrypted = await readFile(this.path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return { key: null, present: false };
      // eslint-disable-next-line preserve-caught-error -- Do not attach native errors or credential paths to public storage failures.
      throw new Error('Credential unreadable.');
    }
    if (!this.available || encrypted.length > 16384)
      throw new Error('Credential unreadable.');
    let plain: Uint8Array | undefined;
    try {
      plain = this.protection.decrypt(encrypted);
      return {
        key: payloadSchema.parse(
          JSON.parse(Buffer.from(plain).toString('utf8')),
        ).key,
        present: true,
      };
    } catch {
      throw new Error('Credential unreadable.');
    } finally {
      plain?.fill(0);
    }
  }
  async save(key: string): Promise<void> {
    return this.write(speechKeySchema.parse(key));
  }
  private async write(key: string | null): Promise<void> {
    if (!this.available) throw new Error('Encryption unavailable.');
    const plain = Buffer.from(JSON.stringify({ version: 1, key }));
    let encrypted: Uint8Array;
    try {
      encrypted = this.protection.encrypt(plain);
    } catch {
      throw new Error('Encryption unavailable.');
    } finally {
      plain.fill(0);
    }
    const temporary = join(this.directory, `${randomUUID()}.tmp`);
    try {
      await mkdir(this.directory, { recursive: true });
      await writeFile(temporary, encrypted, { flag: 'wx', mode: 0o600 });
      await rename(temporary, this.path);
    } catch {
      throw new Error('Credential could not be saved.');
    } finally {
      await rm(temporary, { force: true });
    }
  }
  async remove(): Promise<void> {
    // Remember explicit removal so an inherited environment key cannot reappear on restart.
    await this.write(null);
  }
}
