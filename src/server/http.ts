import type { IncomingMessage, ServerResponse } from 'node:http';
import { localWebStatusSchema } from '../shared/local-web';
import type { LocalWebStatus } from '../shared/local-web';
import {
  approveCardRequestSchema,
  importRequestSchema,
  updateCardRequestSchema,
  workspaceSchema,
} from '../shared/card-import';
import { previewImport } from './card-import';
import type { WorkspaceStore } from './workspace';
import { z } from 'zod';

export type StatusReader = () => Promise<LocalWebStatus>;

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  const content = JSON.stringify(body);
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(content),
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });
  response.end(content);
}

export function createApiHandler(options: {
  expectedHosts: ReadonlySet<string>;
  expectedOrigins: ReadonlySet<string>;
  readStatus: StatusReader;
  workspace?: WorkspaceStore;
  sessionToken?: string;
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
    const cardId = /^\/api\/cards\/([0-9a-f-]{36})(?:\/approval)?$/.exec(
      url.pathname,
    )?.[1];
    if (cardId) {
      const isApproval = url.pathname.endsWith('/approval');
      if (
        request.method !== (isApproval ? 'POST' : 'PATCH') ||
        !options.workspace
      ) {
        sendJson(response, 405, { error: 'method-not-allowed' });
        return true;
      }
      if (
        !origin ||
        !options.expectedOrigins.has(origin) ||
        !options.sessionToken ||
        request.headers['x-workspace-token'] !== options.sessionToken ||
        request.headers['content-type']?.split(';')[0] !== 'application/json'
      ) {
        sendJson(response, 403, { error: 'request-not-allowed' });
        return true;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of request) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size > 100_000) {
          sendJson(response, 413, { error: 'too-large' });
          return true;
        }
        chunks.push(bytes);
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        sendJson(response, 400, { error: 'invalid-json' });
        return true;
      }
      const input = (
        isApproval ? approveCardRequestSchema : updateCardRequestSchema
      ).safeParse(parsed);
      if (!input.success) {
        sendJson(response, 400, { error: 'invalid-request' });
        return true;
      }
      try {
        sendJson(
          response,
          200,
          isApproval
            ? await options.workspace.approve(
                cardId,
                approveCardRequestSchema.parse(input.data),
              )
            : await options.workspace.update(
                cardId,
                updateCardRequestSchema.parse(input.data),
              ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        sendJson(
          response,
          message === 'Stale card revision.'
            ? 409
            : message === 'Card not found.'
              ? 404
              : 400,
          {
            error:
              message === 'Stale card revision.'
                ? 'stale-revision'
                : 'invalid-card-or-storage',
          },
        );
      }
      return true;
    }
    if (
      url.pathname === '/api/import/preview' ||
      url.pathname === '/api/import/save'
    ) {
      if (request.method !== 'POST' || !options.workspace) {
        sendJson(response, 405, { error: 'method-not-allowed' });
        return true;
      }
      if (
        !origin ||
        !options.expectedOrigins.has(origin) ||
        !options.sessionToken ||
        request.headers['x-workspace-token'] !== options.sessionToken ||
        request.headers['content-type']?.split(';')[0] !== 'application/json'
      ) {
        sendJson(response, 403, { error: 'request-not-allowed' });
        return true;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of request) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size > 2_500_000) {
          sendJson(response, 413, { error: 'too-large' });
          return true;
        }
        chunks.push(bytes);
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        sendJson(response, 400, { error: 'invalid-json' });
        return true;
      }
      const input = (
        url.pathname === '/api/import/save'
          ? importRequestSchema.extend({
              selected: z.array(z.number().int().positive()),
            })
          : importRequestSchema
      ).safeParse(parsed);
      if (!input.success) {
        sendJson(response, 400, { error: 'invalid-request' });
        return true;
      }
      const preview = previewImport(input.data);
      if (url.pathname === '/api/import/preview') {
        sendJson(response, 200, preview);
        return true;
      }
      const selection = (parsed as Record<string, unknown>).selected;
      if (
        !Array.isArray(selection) ||
        !selection.every((value) => typeof value === 'number')
      ) {
        sendJson(response, 400, { error: 'invalid-selection' });
        return true;
      }
      try {
        sendJson(
          response,
          200,
          await options.workspace.add(preview, selection),
        );
      } catch {
        sendJson(response, 400, { error: 'invalid-selection-or-storage' });
      }
      return true;
    }
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'method-not-allowed' });
      return true;
    }
    if (url.pathname === '/api/workspace' && options.workspace) {
      sendJson(
        response,
        200,
        workspaceSchema.parse(await options.workspace.read()),
        options.sessionToken
          ? { 'X-Workspace-Token': options.sessionToken }
          : {},
      );
      return true;
    }
    if (url.pathname !== '/api/status') {
      sendJson(response, 404, { error: 'not-found' });
      return true;
    }
    const status = localWebStatusSchema.parse(await options.readStatus());
    sendJson(
      response,
      200,
      status,
      options.sessionToken ? { 'X-Workspace-Token': options.sessionToken } : {},
    );
    return true;
  };
}
