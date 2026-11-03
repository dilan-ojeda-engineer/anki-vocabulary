import type { IncomingMessage, ServerResponse } from 'node:http';
import { localWebStatusSchema } from '../shared/local-web';
import type { LocalWebStatus } from '../shared/local-web';
import {
  approveCardRequestSchema,
  importRequestSchema,
  updateCardRequestSchema,
  workspaceSchema,
} from '../shared/card-import';
import { audioSelectionRequestSchema } from '../shared/audio-plan';
import { previewImport } from './card-import';
import type { WorkspaceStore } from './workspace';
import { z } from 'zod';
import type { AudioService } from './audio-service';
import {
  audioBatchRequestSchema,
  audioGenerateRequestSchema,
} from '../shared/audio-generation';

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
  audio?: AudioService;
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
    const mediaKey = /^\/api\/audio\/([a-f0-9]{64})$/.exec(url.pathname)?.[1];
    if (mediaKey && options.audio) {
      if (request.method !== 'GET') {
        sendJson(response, 405, { error: 'method-not-allowed' });
        return true;
      }
      try {
        const media = await options.audio.media(mediaKey);
        if (!media) {
          sendJson(response, 404, { error: 'not-found' });
          return true;
        }
        response.writeHead(200, {
          'Content-Type':
            media.record.format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
          'Content-Length': media.bytes.length,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'Cross-Origin-Resource-Policy': 'same-origin',
        });
        response.end(media.bytes);
      } catch {
        sendJson(response, 404, { error: 'media-unavailable' });
      }
      return true;
    }
    const cardRoute =
      /^\/api\/cards\/([0-9a-f-]{36})(?:\/(approval|audio-plan|audio-selection|audio-review|audio-prepare|audio-generate))?$/.exec(
        url.pathname,
      );
    const cardId = cardRoute?.[1];
    if (cardId) {
      const action = cardRoute?.[2] ?? 'update';
      if (
        request.method !== (action === 'update' ? 'PATCH' : 'POST') ||
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
        action === 'audio-generate'
          ? audioGenerateRequestSchema
          : action === 'audio-prepare'
            ? audioBatchRequestSchema
            : action === 'audio-selection'
              ? audioSelectionRequestSchema
              : action === 'update'
                ? updateCardRequestSchema
                : approveCardRequestSchema
      ).safeParse(parsed);
      if (!input.success) {
        sendJson(response, 400, { error: 'invalid-request' });
        return true;
      }
      try {
        if (
          ['audio-review', 'audio-prepare', 'audio-generate'].includes(action)
        ) {
          if (!options.audio) {
            sendJson(response, 503, { error: 'audio-unavailable' });
            return true;
          }
          const ref = approveCardRequestSchema.parse({
            expectedRevision: input.data.expectedRevision,
            expectedContentHash:
              'expectedContentHash' in input.data
                ? input.data.expectedContentHash
                : undefined,
          });
          const result =
            action === 'audio-review'
              ? await options.audio.review(
                  cardId,
                  ref.expectedRevision,
                  ref.expectedContentHash,
                )
              : action === 'audio-prepare'
                ? await options.audio.prepare(
                    cardId,
                    audioBatchRequestSchema.parse(input.data),
                  )
                : await options.audio.generate(
                    cardId,
                    audioGenerateRequestSchema.parse(input.data),
                  );
          sendJson(response, 200, result);
          return true;
        }
        sendJson(
          response,
          200,
          action === 'approval'
            ? await options.workspace.approve(
                cardId,
                approveCardRequestSchema.parse(input.data),
              )
            : action === 'audio-plan'
              ? await options.workspace.audioPlan(
                  cardId,
                  approveCardRequestSchema.parse(input.data).expectedRevision,
                  approveCardRequestSchema.parse(input.data)
                    .expectedContentHash,
                )
              : action === 'audio-selection'
                ? await options.workspace.selectAudio(
                    cardId,
                    audioSelectionRequestSchema.parse(input.data),
                  )
                : await options.workspace.update(
                    cardId,
                    updateCardRequestSchema.parse(input.data),
                  ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        const audioError =
          message === 'Speech provider is not configured.'
            ? 'speech-not-configured'
            : message === 'Speech allowance could not be verified.'
              ? 'allowance-check-failed'
              : message === 'Confirmed free speech allowance is unavailable.'
                ? 'free-allowance-unavailable'
                : message === 'Audio preview expired. Prepare the batch again.'
                  ? 'audio-preview-expired'
                  : null;
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
                : (audioError ?? 'invalid-card-or-storage'),
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
