import { createServer, request as requestHttp } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AnkiConnectError } from '../../src/integrations/anki/client';
import {
  readAnkiStatus,
  type AnkiReadClient,
} from '../../src/server/anki-status';
import { createApiHandler } from '../../src/server/http';
import { localWebStatusSchema } from '../../src/shared/local-web';

class FakeAnkiClient implements AnkiReadClient {
  readonly methods: string[] = [];

  constructor(
    private readonly values: Readonly<Record<string, unknown>>,
    private readonly failure?: unknown,
  ) {}

  async call<S extends z.ZodType>(
    method: string,
    _params: Readonly<Record<string, unknown>>,
    schema: S,
  ): Promise<z.output<S>> {
    this.methods.push(method);
    if (this.failure) throw this.failure;
    return schema.parse(this.values[method]);
  }
}

const description = {
  apiMajor: 1,
  ankiVersion: '26.09.3',
  methods: [
    { name: 'collection.get', available: true, reason: null },
    { name: 'decks.list', available: true, reason: null },
  ],
};
const collection = {
  profile: 'Disposable',
  session: 'private-session-token',
  scheduler: 'fsrs',
};
const decks = [
  { id: '9', name: 'Work', kind: 'normal', presetId: '1' },
  { id: '2', name: 'English::Daily', kind: 'normal', presetId: '1' },
];

const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
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

async function startApi(
  readStatus: () => ReturnType<typeof readAnkiStatus>,
): Promise<string> {
  const expectedHosts = new Set<string>();
  const handler = createApiHandler({
    expectedHosts,
    expectedOrigins: new Set(['http://allowed.test']),
    readStatus,
  });
  const server = createServer((request, response) => {
    void handler(request, response);
  });
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address() as AddressInfo;
  expectedHosts.add(`127.0.0.1:${address.port}`);
  return `http://127.0.0.1:${address.port}`;
}

async function requestWithHost(url: string, host: string): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const request = requestHttp(
      url,
      { headers: { Host: host } },
      (response) => {
        response.resume();
        response.once('end', () => resolve(response.statusCode ?? 0));
      },
    );
    request.once('error', reject);
    request.end();
  });
}

describe('local web foundation', () => {
  it('returns a sorted public deck list without exposing the collection session', async () => {
    const client = new FakeAnkiClient({
      'api.describe': description,
      'collection.get': collection,
      'decks.list': decks,
    });
    const result = await readAnkiStatus(client);
    expect(result).toEqual({
      server: { status: 'ready' },
      anki: {
        status: 'connected',
        ankiVersion: '26.09.3',
        profile: 'Disposable',
        decks: [
          { id: '2', name: 'English::Daily', kind: 'normal' },
          { id: '9', name: 'Work', kind: 'normal' },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toContain(collection.session);
  });

  it('reports unsupported capabilities without making collection requests', async () => {
    const client = new FakeAnkiClient({
      'api.describe': {
        ...description,
        methods: [{ name: 'collection.get', available: true, reason: null }],
      },
    });
    await expect(readAnkiStatus(client)).resolves.toMatchObject({
      anki: {
        status: 'unavailable',
        reason: 'unsupported-or-invalid-response',
      },
    });
    expect(client.methods).toEqual(['api.describe']);
  });

  it('sanitizes transport failures as an unavailable status', async () => {
    const secret = 'provider-or-connection-secret';
    const client = new FakeAnkiClient(
      {},
      new AnkiConnectError('TRANSPORT', false, secret),
    );
    const result = await readAnkiStatus(client);
    expect(result).toMatchObject({
      anki: {
        status: 'unavailable',
        reason: 'not-running-or-unreachable',
      },
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('serves validated read-only status and rejects foreign origins and mutations', async () => {
    const connected = localWebStatusSchema.parse({
      server: { status: 'ready' },
      anki: {
        status: 'connected',
        ankiVersion: '26.09.3',
        profile: 'Disposable',
        decks: [],
      },
    });
    const baseUrl = await startApi(async () => connected);

    const response = await fetch(`${baseUrl}/api/status`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(localWebStatusSchema.parse(await response.json())).toEqual(
      connected,
    );

    const foreign = await fetch(`${baseUrl}/api/status`, {
      headers: { Origin: 'https://foreign.example' },
    });
    expect(foreign.status).toBe(403);

    expect(
      await requestWithHost(`${baseUrl}/api/status`, 'foreign.example'),
    ).toBe(403);

    const mutation = await fetch(`${baseUrl}/api/status`, { method: 'POST' });
    expect(mutation.status).toBe(405);
  });
});
