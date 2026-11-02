import type { IncomingMessage, ServerResponse } from 'node:http';
import { localWebStatusSchema } from '../shared/local-web';
import type { LocalWebStatus } from '../shared/local-web';

export type StatusReader = () => Promise<LocalWebStatus>;

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  const content = JSON.stringify(body);
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(content),
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(content);
}

export function createApiHandler(options: {
  expectedHosts: ReadonlySet<string>;
  expectedOrigins: ReadonlySet<string>;
  readStatus: StatusReader;
}) {
  return async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<boolean> => {
    const url = new URL(request.url ?? '/', 'http://local.invalid');
    if (!url.pathname.startsWith('/api/')) return false;

    const host = request.headers.host;
    if (!host || !options.expectedHosts.has(host)) {
      sendJson(response, 403, { error: 'host-not-allowed' });
      return true;
    }
    const origin = request.headers.origin;
    if (origin && !options.expectedOrigins.has(origin)) {
      sendJson(response, 403, { error: 'origin-not-allowed' });
      return true;
    }
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'method-not-allowed' });
      return true;
    }
    if (url.pathname !== '/api/status') {
      sendJson(response, 404, { error: 'not-found' });
      return true;
    }
    const status = localWebStatusSchema.parse(await options.readStatus());
    sendJson(response, 200, status);
    return true;
  };
}
