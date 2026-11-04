import { z } from 'zod';
import { deliveryRefSchema } from './delivery';
import { audioPlacementIdSchema } from './audio-plan';

const decimalId = z.string().regex(/^[1-9][0-9]*$/);
export const noteListRequestSchema = z.strictObject({ deckId: decimalId });
export const noteLoadRequestSchema = noteListRequestSchema.extend({
  noteId: decimalId,
});
export const noteDraftRequestSchema = z.strictObject({
  loadId: z.uuid(),
  expectedRevision: z.number().int().positive(),
});
export const noteUpdateRequestSchema = z.strictObject({
  loadId: z.uuid(),
  card: deliveryRefSchema,
  mode: z.enum(['content', 'audio']),
  placementId: audioPlacementIdSchema.optional(),
});
export const noteUpdateSendSchema = z.strictObject({
  previewId: z.uuid(),
  reviewed: z.literal(true),
});
export const noteReconcileSchema = z.strictObject({ updateId: z.uuid() });
export const noteListSchema = z.strictObject({
  notes: z.array(
    z.strictObject({
      sourceId: z.uuid(),
      noteId: decimalId,
      target: z.string(),
    }),
  ),
});
export const noteLoadedSchema = z.strictObject({
  loadId: z.uuid(),
  sourceId: z.uuid(),
  noteId: decimalId,
  deckId: decimalId,
  deckName: z.string(),
  profile: z.string(),
  fields: z.record(z.string(), z.unknown()),
  audio: z.array(
    z.strictObject({ placementId: audioPlacementIdSchema, url: z.string() }),
  ),
});
export const noteUpdatePreviewSchema = z.strictObject({
  previewId: z.uuid(),
  sourceId: z.uuid(),
  noteId: decimalId,
  revision: z.number().int().positive(),
  deckName: z.string(),
  profile: z.string(),
  mode: z.enum(['content', 'audio']),
  changes: z.array(
    z.strictObject({
      field: z.string(),
      before: z.string(),
      after: z.string(),
    }),
  ),
  audio: z.array(
    z.strictObject({
      placementId: audioPlacementIdSchema,
      currentUrl: z.string().nullable(),
      proposedUrl: z.string().nullable(),
    }),
  ),
  changedFields: z.number().int().nonnegative(),
});
export const noteUpdateResultSchema = z.strictObject({
  updateId: z.uuid(),
  sourceId: z.uuid(),
  noteId: decimalId,
  target: z.string(),
  state: z.enum([
    'pending',
    'writing',
    'complete',
    'ambiguous',
    'conflict',
    'not-applied',
  ]),
  reason: z.string(),
});
export const noteUpdateStatusSchema = z.strictObject({
  items: z.array(noteUpdateResultSchema),
});
export type NoteLoaded = z.infer<typeof noteLoadedSchema>;
export type NoteUpdateRequest = z.infer<typeof noteUpdateRequestSchema>;
export type NoteUpdatePreview = z.infer<typeof noteUpdatePreviewSchema>;
export type NoteUpdateResult = z.infer<typeof noteUpdateResultSchema>;
