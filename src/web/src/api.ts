import { localWebStatusSchema } from '../../shared/local-web';
import type { LocalWebStatus } from '../../shared/local-web';
import { importPreviewSchema, workspaceSchema } from '../../shared/card-import';
import type {
  ImportRequest,
  UpdateCardRequest,
} from '../../shared/card-import';

let workspaceToken: string | null = null;

export async function getLocalWebStatus(): Promise<LocalWebStatus> {
  const response = await fetch('/api/status', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Local status request failed.');
  return localWebStatusSchema.parse(await response.json());
}

export async function previewCards(input: ImportRequest) {
  return importPreviewSchema.parse(await post('/api/import/preview', input));
}

export async function saveCards(input: ImportRequest, selected: number[]) {
  return workspaceSchema.parse(
    await post('/api/import/save', { ...input, selected }),
  );
}

export async function updateCard(id: string, input: UpdateCardRequest) {
  return workspaceSchema.parse(await post(`/api/cards/${id}`, input, 'PATCH'));
}

export async function getWorkspace() {
  const response = await fetch('/api/workspace', { cache: 'no-store' });
  if (!response.ok) throw new Error('Workspace could not be loaded.');
  workspaceToken = response.headers.get('x-workspace-token');
  if (!workspaceToken) throw new Error('Workspace session is unavailable.');
  return workspaceSchema.parse(await response.json());
}

async function post(
  url: string,
  body: unknown,
  method: 'POST' | 'PATCH' = 'POST',
): Promise<unknown> {
  if (!workspaceToken) throw new Error('Workspace session is unavailable.');
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Workspace-Token': workspaceToken,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Import request failed.');
  return response.json();
}
