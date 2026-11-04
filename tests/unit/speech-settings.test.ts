import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it } from 'vitest';
import {
  CredentialStore,
  windowsSecretProtection,
} from '../../src/server/credential-store';
import type { SecretProtection } from '../../src/server/credential-store';
import { SpeechSettingsService } from '../../src/server/speech-settings';
import { SpeechAllowanceError } from '../../src/server/elevenlabs';
import { createApiHandler } from '../../src/server/http';
import type { AudioAllowance } from '../../src/server/audio-service';

const key = 'fake_private_fixture_key_123';
const replacement = 'fake_replacement_fixture_456';
const free: AudioAllowance = {
  tier: 'free',
  used: 12,
  limit: 10000,
  canExtend: false,
};
const folders: string[] = [];
afterEach(async () => {
  await Promise.all(
    folders.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

// Test encryption only; production always uses Windows DPAPI with no fallback.
function fakeProtection(): SecretProtection {
  const secret = randomBytes(32);
  return {
    available: true,
    encrypt(bytes) {
      const iv = randomBytes(12);
      const c = createCipheriv('aes-256-gcm', secret, iv);
      const data = Buffer.concat([c.update(bytes), c.final()]);
      return Buffer.concat([iv, c.getAuthTag(), data]);
    },
    decrypt(bytes) {
      const b = Buffer.from(bytes);
      const c = createDecipheriv('aes-256-gcm', secret, b.subarray(0, 12));
      c.setAuthTag(b.subarray(12, 28));
      return Buffer.concat([c.update(b.subarray(28)), c.final()]);
    },
  };
}
async function setup(
  check: (value: string) => Promise<AudioAllowance> = async () => free,
  protection = fakeProtection(),
) {
  const directory = await mkdtemp(join(tmpdir(), 'anki-credential-test-'));
  folders.push(directory);
  const store = new CredentialStore(directory, protection);
  const service = new SpeechSettingsService(store, check);
  await service.initialize();
  return { directory, protection, store, service };
}

it('saves encrypted bytes, recovers after restart, validates again and never returns the key', async () => {
  const seen: string[] = [];
  const check = async (value: string) => {
    seen.push(value);
    return free;
  };
  const { directory, store, service } = await setup(check);
  const status = await service.action({ action: 'save', key });
  expect(status).toMatchObject({ source: 'saved', state: 'ready' });
  expect(JSON.stringify(status)).not.toContain(key);
  expect(
    (await readFile(join(directory, 'elevenlabs.dpapi'))).includes(
      Buffer.from(key),
    ),
  ).toBe(false);
  expect(await readdir(directory)).toEqual(['elevenlabs.dpapi']);
  const restarted = new SpeechSettingsService(store, check);
  await restarted.initialize(replacement);
  expect(restarted.status()).toMatchObject({
    source: 'saved',
    state: 'unchecked',
    configured: true,
  });
  await restarted.action({ action: 'check' });
  expect(seen).toEqual([key, key]);
  await restarted.readAllowance();
  expect(seen).toHaveLength(3);
  expect(JSON.stringify(restarted.provider()?.configuration)).not.toContain(
    key,
  );
});

it('keeps the working saved key when replacement validation fails and serializes remove after save', async () => {
  let reject = false;
  const { service, store } = await setup(async () => {
    if (reject) throw new Error(key);
    return free;
  });
  await service.action({ action: 'save', key });
  reject = true;
  await expect(
    service.action({ action: 'save', key: replacement }),
  ).rejects.toMatchObject({ message: 'credential-validation-failed' });
  expect(await store.read()).toBe(key);
  expect(service.status()).toMatchObject({ source: 'saved', configured: true });
  reject = false;
  await Promise.all([
    service.action({ action: 'save', key: replacement }),
    service.action({ action: 'remove' }),
  ]);
  expect(await store.read()).toBe(null);
  expect(service.provider()).toBe(null);
  const restarted = new SpeechSettingsService(store);
  await restarted.initialize(key);
  expect(restarted.status()).toMatchObject({
    configured: false,
    state: 'missing',
  });
});

it('waits for an in-flight speech operation before changing credentials', async () => {
  const { service } = await setup();
  await service.action({ action: 'save', key });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const beginning = new Promise<void>((resolve) => {
    started = resolve;
  });
  const operation = service.withCredentials(async () => {
    started();
    await gate;
    expect(service.status().configured).toBe(true);
    return 'finished';
  });
  await beginning;
  const removal = service.action({ action: 'remove' });
  expect(service.status().configured).toBe(true);
  release();
  expect(await operation).toBe('finished');
  expect(await removal).toMatchObject({ configured: false });
});

it('fails closed for unavailable encryption, failed writes and unreadable protected data', async () => {
  const unavailable: SecretProtection = {
    available: false,
    encrypt: () => {
      throw new Error(key);
    },
    decrypt: () => {
      throw new Error(key);
    },
  };
  const first = await setup(async () => free, unavailable);
  await expect(
    first.service.action({ action: 'save', key }),
  ).rejects.toMatchObject({ message: 'credential-storage-failed' });
  expect(await readdir(first.directory)).toEqual([]);
  const second = await setup();
  await writeFile(
    join(second.directory, 'elevenlabs.dpapi'),
    'tampered encrypted data',
  );
  await second.service.initialize(key);
  expect(second.service.status()).toMatchObject({
    configured: false,
    state: 'blocked',
    issue: 'credential-unreadable',
  });
  await second.service.action({ action: 'save', key });
  expect(await second.store.read()).toBe(key);
  const broken = await setup(async () => free, {
    ...fakeProtection(),
    encrypt: () => {
      throw new Error(key);
    },
  });
  await expect(
    broken.service.action({ action: 'save', key }),
  ).rejects.toMatchObject({ message: 'credential-storage-failed' });
  expect(broken.service.status().configured).toBe(false);
  expect(await readdir(broken.directory)).toEqual([]);
});

it('keeps environment credentials temporary and reports account failures without paid fallback', async () => {
  let allowance = free;
  let error: Error | null = null;
  const { service, directory } = await setup(async () => {
    if (error) throw error;
    return allowance;
  });
  await service.initialize(key);
  expect(service.status()).toMatchObject({
    configured: true,
    source: 'session',
  });
  expect(await readdir(directory)).toEqual([]);
  for (const value of [
    { ...free, tier: 'starter' },
    { ...free, canExtend: true },
    { ...free, used: free.limit },
  ]) {
    allowance = value;
    expect(await service.action({ action: 'check' })).toMatchObject({
      state: 'blocked',
      issue: 'free-allowance-unavailable',
    });
  }
  error = new SpeechAllowanceError('speech-account-access-denied');
  expect(await service.action({ action: 'check' })).toMatchObject({
    state: 'blocked',
    issue: 'account-access-denied',
  });
  error = new Error(key);
  const status = await service.action({ action: 'check' });
  expect(status.issue).toBe('account-unavailable');
  expect(JSON.stringify(status)).not.toContain(key);
  await service.action({ action: 'remove' });
  expect(service.status().configured).toBe(false);
});

it('protects settings writes with origin, token, schema and size checks without echoing secrets', async () => {
  const { service } = await setup();
  const hosts = new Set<string>();
  const handler = createApiHandler({
    expectedHosts: hosts,
    expectedOrigins: new Set(['http://allowed.test']),
    sessionToken: 'fixture-token',
    speechSettings: service,
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
  const url = `http://127.0.0.1:${port}/api/speech/settings`;
  const post = (
    body: unknown,
    token = 'fixture-token',
    origin = 'http://allowed.test',
  ) =>
    fetch(url, {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        'X-Workspace-Token': token,
      },
      body: JSON.stringify(body),
    });
  try {
    expect((await post({ action: 'save', key }, '')).status).toBe(403);
    expect(
      (await post({ action: 'save', key }, 'fixture-token', 'http://evil.test'))
        .status,
    ).toBe(403);
    expect((await post({ action: 'save', key, extra: true })).status).toBe(400);
    expect((await post({ action: 'save', key: 'x'.repeat(3000) })).status).toBe(
      413,
    );
    const save = await post({ action: 'save', key });
    expect(save.status).toBe(200);
    expect(await save.text()).not.toContain(key);
    const read = await fetch(url);
    expect(read.headers.get('cache-control')).toBe('no-store');
    expect(await read.text()).not.toContain(key);
    const invalid = await post({ action: 'save', key: 'secret\ninvalid' });
    expect(await invalid.text()).not.toContain('secret');
    expect((await post({ action: 'remove' })).status).toBe(200);
    expect(service.status().configured).toBe(false);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

it.skipIf(process.platform !== 'win32')(
  'round-trips a fake key using real Windows protection and detects tampering',
  async () => {
    const protection = await windowsSecretProtection();
    expect(protection.available).toBe(true);
    const { store, directory } = await setup(async () => free, protection);
    await store.save(key);
    expect(await store.read()).toBe(key);
    const bytes = await readFile(join(directory, 'elevenlabs.dpapi'));
    expect(bytes.includes(Buffer.from(key))).toBe(false);
    bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 1;
    await writeFile(join(directory, 'elevenlabs.dpapi'), bytes);
    await expect(store.read()).rejects.toThrow('Credential unreadable.');
  },
);
