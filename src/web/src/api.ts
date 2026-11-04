import { localWebStatusSchema } from '../../shared/local-web';
import type { LocalWebStatus } from '../../shared/local-web';
import { importPreviewSchema, workspaceSchema } from '../../shared/card-import';
import type {
  ApproveCardRequest,
  ImportRequest,
  UpdateCardRequest,
} from '../../shared/card-import';
import { audioPlanSchema } from '../../shared/audio-plan';
import type { AudioSelectionRequest } from '../../shared/audio-plan';
import {
  audioReviewSchema,
  audioPreflightSchema,
} from '../../shared/audio-generation';
import type {
  AudioBatchRequest,
  AudioGenerateRequest,
} from '../../shared/audio-generation';
import {
  deliveryPreviewSchema,
  deliveryStatusSchema,
} from '../../shared/delivery';
import type { DeliveryRequest } from '../../shared/delivery';
import { speechSettingsSchema } from '../../shared/speech-settings';
import type { SpeechSettingsRequest } from '../../shared/speech-settings';

let workspaceToken: string | null = null;

export class WorkspaceConflictError extends Error {}
export class AudioRequestError extends Error {}
export class DeliveryRequestError extends Error {}

export async function getSpeechSettings() {
  const response = await fetch('/api/speech/settings', { cache: 'no-store' });
  if (!response.ok)
    throw new Error(
      'Speech settings are unavailable. Restart the local server to load the settings feature.',
    );
  workspaceToken = response.headers.get('x-workspace-token') ?? workspaceToken;
  return speechSettingsSchema.parse(await response.json());
}
export async function updateSpeechSettings(input: SpeechSettingsRequest) {
  return speechSettingsSchema.parse(await post('/api/speech/settings', input));
}

export async function getDeliveryStatus() {
  const response = await fetch('/api/delivery/status', { cache: 'no-store' });
  if (!response.ok)
    throw new DeliveryRequestError(
      'Saved delivery receipts could not be loaded.',
    );
  return deliveryStatusSchema.parse(await response.json());
}
export async function prepareDelivery(input: DeliveryRequest) {
  return deliveryPreviewSchema.parse(
    await post('/api/delivery/prepare', input),
  );
}
export async function sendDelivery(previewId: string) {
  return deliveryStatusSchema.parse(
    await post('/api/delivery/send', { previewId, reviewed: true }),
  );
}

export async function getLocalWebStatus(): Promise<LocalWebStatus> {
  const response = await fetch('/api/status', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Local status request failed.');
  workspaceToken = response.headers.get('x-workspace-token') ?? workspaceToken;
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

export async function approveCard(id: string, input: ApproveCardRequest) {
  return workspaceSchema.parse(await post(`/api/cards/${id}/approval`, input));
}

export async function getAudioPlan(id: string, input: ApproveCardRequest) {
  return audioPlanSchema.parse(
    await post(`/api/cards/${id}/audio-plan`, input),
  );
}
export async function getAudioReview(id: string, input: ApproveCardRequest) {
  return audioReviewSchema.parse(
    await post(`/api/cards/${id}/audio-review`, input),
  );
}
export async function prepareAudio(id: string, input: AudioBatchRequest) {
  return audioPreflightSchema.parse(
    await post(`/api/cards/${id}/audio-prepare`, input),
  );
}
export async function generateAudio(id: string, input: AudioGenerateRequest) {
  return audioReviewSchema.parse(
    await post(`/api/cards/${id}/audio-generate`, input),
  );
}

export async function selectAudio(id: string, input: AudioSelectionRequest) {
  return workspaceSchema.parse(
    await post(`/api/cards/${id}/audio-selection`, input),
  );
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
  if (response.status === 409)
    throw new WorkspaceConflictError('The card revision is stale.');
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    const code =
      data && typeof data === 'object' && 'error' in data ? data.error : null;
    const message =
      code === 'credential-validation-failed'
        ? 'The key could not be validated. Check the key, account permissions, and connection. Your previous saved key was kept.'
        : code === 'credential-storage-failed'
          ? 'Secure key storage failed. No plaintext fallback was used.'
          : code === 'invalid-credential' || code === 'invalid-settings-request'
            ? 'Enter a valid API key. No key was saved.'
            : code === 'speech-not-configured'
              ? 'Open Speech settings and validate/save your ElevenLabs key. No server restart is needed.'
              : code === 'speech-account-access-denied'
                ? 'ElevenLabs denied the account check (401/403). Check that the key is valid and has account/subscription read permission, then check or replace it in Speech settings. No audio was generated.'
                : code === 'speech-account-rate-limited'
                  ? 'ElevenLabs rate-limited the account check. Wait and try again. No audio was generated.'
                  : code === 'allowance-check-failed'
                    ? 'Could not verify ElevenLabs allowance. Check the connection and account access, then try again. No audio was generated.'
                    : code === 'free-allowance-unavailable'
                      ? 'Available free allowance could not cover this request. No paid fallback was used.'
                      : code === 'audio-preview-expired'
                        ? 'Audio preview expired. Prepare this batch again.'
                        : null;
    if (
      code === 'delivery-blocked' &&
      data &&
      typeof data === 'object' &&
      'message' in data &&
      typeof data.message === 'string' &&
      data.message.length <= 300
    )
      throw new DeliveryRequestError(data.message);
    if (message) throw new AudioRequestError(message);
    throw new Error('Workspace request failed.');
  }
  return response.json();
}
