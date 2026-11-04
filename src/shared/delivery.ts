import { z } from 'zod';

export const deliveryRefSchema = z.strictObject({
  id: z.uuid(),
  revision: z.number().int().positive(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export const deliveryRequestSchema = z.strictObject({
  deckId: z.string().regex(/^[1-9][0-9]*$/),
  cards: z.array(deliveryRefSchema).min(1).max(50),
});
export const deliveryConfirmSchema = z.strictObject({
  previewId: z.uuid(),
  reviewed: z.literal(true),
});
export const deliveryItemSchema = z.strictObject({
  id: z.uuid(),
  target: z.string(),
  revision: z.number().int().positive(),
  state: z.enum([
    'pending',
    'creating',
    'ambiguous',
    'complete',
    'failed',
    'blocked',
  ]),
  intent: z.enum(['create', 'omit', 'unchanged', 'reconcile']),
  reason: z.string(),
  noteId: z.string().nullable(),
  audioCount: z.number().int().nonnegative(),
});
export const deliveryStatusSchema = z.strictObject({
  items: z.array(deliveryItemSchema),
});
export const deliveryPreviewSchema = z.strictObject({
  previewId: z.uuid(),
  profile: z.string(),
  deckId: z.string(),
  deckName: z.string(),
  noteType: z.string(),
  items: z.array(deliveryItemSchema),
});
export type DeliveryRequest = z.infer<typeof deliveryRequestSchema>;
export type DeliveryPreview = z.infer<typeof deliveryPreviewSchema>;
export type DeliveryItem = z.infer<typeof deliveryItemSchema>;
