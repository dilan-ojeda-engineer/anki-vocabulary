import { z } from 'zod';

const errorSchema = z.object({
  code: z.number().int(),
  message: z.string(),
  data: z.object({ type: z.string() }).passthrough().optional(),
});
const replySchema = z.union([
  z.strictObject({
    jsonrpc: z.literal('2.0'),
    id: z.number().int(),
    result: z.unknown(),
  }),
  z.strictObject({
    jsonrpc: z.literal('2.0'),
    id: z.number().int(),
    error: errorSchema,
  }),
]);

export class AnkiConnectError extends Error {
  constructor(
    readonly code: 'TRANSPORT' | 'PROTOCOL' | 'REMOTE' | 'OPERATION_PENDING',
    readonly mayHaveCommitted: boolean,
    readonly remoteType?: string,
    readonly operationId?: string,
  ) {
    // Do not copy server messages, request bodies, or credentials into errors.
    super(`AnkiConnect ${code}${remoteType ? ` (${remoteType})` : ''}`);
    this.name = 'AnkiConnectError';
  }
}

export function validateEndpoint(endpoint: string): string {
  const url = new URL(endpoint);
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/api/v1'
  ) {
    throw new Error(
      'AnkiConnect requires an explicit loopback /api/v1 endpoint.',
    );
  }
  return url.href;
}

export const operationHandleSchema = z.strictObject({
  operationId: z.string().min(1),
  method: z.string().min(1),
  session: z.string().min(1).nullable(),
});

/** Backend-only transport. This is never exposed through the preload bridge. */
export class AnkiConnectClient {
  private nextId = 0;
  private readonly calls: string[] = [];
  readonly endpoint: string;

  constructor(
    endpoint: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly timeoutMs = 5000,
  ) {
    this.endpoint = validateEndpoint(endpoint);
  }

  get requestLog(): readonly string[] {
    return [...this.calls];
  }

  async call<S extends z.ZodType>(
    method: string,
    params: Readonly<Record<string, unknown>>,
    schema: S,
    mutation = false,
  ): Promise<z.output<S>> {
    const id = ++this.nextId;
    this.calls.push(method);
    let response: Response;
    try {
      response = await this.fetcher(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'error',
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new AnkiConnectError('TRANSPORT', mutation);
    }
    if (!response.ok) throw new AnkiConnectError('TRANSPORT', mutation);
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new AnkiConnectError('PROTOCOL', mutation);
    }
    const parsed = replySchema.safeParse(raw);
    if (!parsed.success || parsed.data.id !== id)
      throw new AnkiConnectError('PROTOCOL', mutation);
    if ('error' in parsed.data)
      throw new AnkiConnectError(
        'REMOTE',
        mutation,
        parsed.data.error.data?.type,
      );
    if (!Object.hasOwn(parsed.data, 'result'))
      throw new AnkiConnectError('PROTOCOL', mutation);
    const result = schema.safeParse(parsed.data.result);
    if (!result.success) throw new AnkiConnectError('PROTOCOL', mutation);
    return result.data;
  }

  async wait<S extends z.ZodType>(
    handle: z.infer<typeof operationHandleSchema>,
    session: string,
    schema: S,
    timeoutMs = 15000,
  ): Promise<z.output<S>> {
    if (handle.session !== session)
      throw new Error('Operation belongs to another collection session.');
    const deadline = Date.now() + timeoutMs;
    const operationSchema = z.object({
      operationId: z.string(),
      method: z.string(),
      session: z.string().nullable(),
      state: z.enum([
        'queued',
        'running',
        'waitingForUser',
        'succeeded',
        'failed',
        'cancelled',
      ]),
      result: z.unknown().optional(),
      error: errorSchema.optional(),
    });
    while (Date.now() < deadline) {
      const operation = await this.call(
        'operations.get',
        { operationId: handle.operationId },
        operationSchema,
      ).catch((error: unknown) => {
        if (error instanceof AnkiConnectError)
          throw new AnkiConnectError(
            error.code,
            true,
            error.remoteType,
            handle.operationId,
          );
        throw error;
      });
      if (
        operation.operationId !== handle.operationId ||
        operation.method !== handle.method ||
        operation.session !== session
      ) {
        throw new AnkiConnectError(
          'PROTOCOL',
          true,
          undefined,
          handle.operationId,
        );
      }
      if (operation.state === 'succeeded') {
        const result = schema.safeParse(operation.result);
        if (!result.success)
          throw new AnkiConnectError(
            'PROTOCOL',
            true,
            undefined,
            handle.operationId,
          );
        return result.data;
      }
      if (operation.state === 'failed' || operation.state === 'cancelled') {
        throw new AnkiConnectError(
          'REMOTE',
          true,
          operation.error?.data?.type,
          handle.operationId,
        );
      }
      if (operation.state === 'waitingForUser')
        throw new AnkiConnectError(
          'OPERATION_PENDING',
          true,
          undefined,
          handle.operationId,
        );
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new AnkiConnectError(
      'OPERATION_PENDING',
      true,
      undefined,
      handle.operationId,
    );
  }
}
