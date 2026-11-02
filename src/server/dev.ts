import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createAnkiReadClient, readAnkiStatus } from './anki-status';
import { createApiHandler } from './http';

const host = '127.0.0.1';
const rawPort = process.env.LOCAL_WEB_PORT ?? '43110';
const port = Number(rawPort);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535)
  throw new Error('LOCAL_WEB_PORT must be an integer from 1 to 65535.');

const ankiEndpoint =
  process.env.ANKI_CONNECT_URL ?? 'http://127.0.0.1:8765/api/v1';
const anki = createAnkiReadClient(ankiEndpoint);
const baseUrl = `http://${host}:${port}`;
const api = createApiHandler({
  expectedHosts: new Set([`${host}:${port}`, `localhost:${port}`]),
  expectedOrigins: new Set([baseUrl, `http://localhost:${port}`]),
  readStatus: () => readAnkiStatus(anki),
});
const vite = await createViteServer({
  configFile: resolve('vite.local-web.config.ts'),
  server: { middlewareMode: true, ws: { host } },
  appType: 'spa',
});
const server = createServer(async (request, response) => {
  try {
    if (await api(request, response)) return;
    vite.middlewares(request, response, () => {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    });
  } catch {
    if (!response.headersSent)
      response.writeHead(500, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
    response.end(JSON.stringify({ error: 'local-server-failure' }));
  }
});

await new Promise<void>((resolveListen, reject) => {
  server.once('error', reject);
  server.listen(port, host, () => resolveListen());
});
console.log(`Local web workspace ready at ${baseUrl}`);

async function stop(): Promise<void> {
  await vite.close();
  await new Promise<void>((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
}

for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void stop().finally(() => process.exit(0));
  });
