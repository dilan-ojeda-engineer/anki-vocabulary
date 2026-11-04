import { z } from 'zod';
import { audioItemSchema, audioSelectionRequestSchema } from './audio-plan';
import { speechConfigurationSchema } from './contracts/speech';

export const audioBatchRequestSchema = audioSelectionRequestSchema.extend({
  mode: z.enum(['explicit', 'missing', 'replacement']),
});
export const audioGenerateRequestSchema = audioBatchRequestSchema.extend({
  preflightId: z.uuid(),
});
export const audioReviewSchema = z.strictObject({
  cardId: z.uuid(),
  revision: z.number().int().positive(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  configuration: speechConfigurationSchema.nullable(),
  voiceName: z.string(),
  items: z.array(
    audioItemSchema.extend({
      audioState: z.enum([
        'missing',
        'stale',
        'complete',
        'failed',
        'paused',
        'invalid',
      ]),
      artifactKey: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .nullable(),
      previousKey: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .nullable(),
      previousText: z.string().nullable(),
      error: z.string().nullable(),
      retryMode: z.enum(['explicit', 'replacement']).default('explicit'),
    }),
  ),
});
export const audioPreflightSchema = z.strictObject({
  id: z.uuid(),
  clipCount: z.number().int().nonnegative(),
  characterCount: z.number().int().nonnegative(),
  uncachedCharacters: z.number().int().nonnegative(),
  uncachedRequests: z.array(
    z.strictObject({
      key: z.string().regex(/^[a-f0-9]{64}$/),
      characterCount: z.number().int().positive(),
    }),
  ),
  allowance: z.strictObject({
    tier: z.string(),
    used: z.number().nonnegative(),
    limit: z.number().nonnegative(),
  }),
  configuration: speechConfigurationSchema,
  voiceName: z.string(),
});
export type AudioBatchRequest = z.infer<typeof audioBatchRequestSchema>;
export type AudioGenerateRequest = z.infer<typeof audioGenerateRequestSchema>;
export type AudioReview = z.infer<typeof audioReviewSchema>;
export type AudioPreflight = z.infer<typeof audioPreflightSchema>;

export function hasBlockingAudioFailure(
  review: AudioReview,
  request: AudioBatchRequest,
): boolean {
  return review.items.some(
    (item) =>
      (request.mode === 'missing' ||
        request.placementIds.includes(item.placementId)) &&
      (item.audioState === 'paused' ||
        item.error === 'quota' ||
        item.error === 'configuration'),
  );
}
