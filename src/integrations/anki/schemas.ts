import { z } from 'zod';

export const entityIdSchema = z.string().regex(/^[1-9][0-9]*$/);
export const entitySummarySchema = z.object({
  id: entityIdSchema,
  name: z.string().min(1),
});
export const collectionSchema = z.strictObject({
  profile: z.string().min(1),
  session: z.string().min(1),
  scheduler: z.enum(['sm2', 'fsrs']),
});
export const descriptionSchema = z.object({
  apiMajor: z.literal(1),
  ankiVersion: z.string().min(1),
  methods: z.array(
    z.object({
      name: z.string(),
      available: z.boolean(),
      reason: z.string().nullable(),
    }),
  ),
});
export const deckSchema = entitySummarySchema.extend({
  kind: z.enum(['normal', 'filtered']),
  presetId: entityIdSchema.nullable(),
});
export const noteSchema = z.object({
  id: entityIdSchema,
  noteType: entitySummarySchema,
  fields: z.record(z.string(), z.string()),
  tags: z.array(z.string()),
  cardIds: z.array(entityIdSchema),
  modifiedAt: z.string(),
});
export const noteCreatedSchema = z.strictObject({
  noteId: entityIdSchema,
  cardIds: z.array(entityIdSchema),
});
const nonnegativeInteger = z.number().int().nonnegative();
export const schedulingSchema = z.strictObject({
  type: z.enum(['new', 'learning', 'review', 'relearning']),
  queue: z.enum([
    'new',
    'learning',
    'review',
    'dayLearning',
    'preview',
    'suspended',
    'buriedByScheduler',
    'buriedByUser',
  ]),
  due: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('position'),
      position: nonnegativeInteger,
    }),
    z.strictObject({ kind: z.literal('timestamp'), at: z.string() }),
    z.strictObject({ kind: z.literal('day'), day: z.number().int() }),
  ]),
  intervalDays: nonnegativeInteger,
  learningIntervalSeconds: nonnegativeInteger.nullable(),
  remainingSteps: nonnegativeInteger,
  repetitions: nonnegativeInteger,
  lapses: nonnegativeInteger,
  sm2EasePermille: nonnegativeInteger,
  fsrsMemory: z
    .strictObject({
      difficulty: z.number().min(0).max(10),
      stabilityDays: z.number().nonnegative(),
    })
    .nullable(),
  desiredRetention: z.number().gt(0).lt(1).nullable(),
});
export const cardSchema = z.object({
  id: entityIdSchema,
  noteId: entityIdSchema,
  deck: entitySummarySchema,
  homeDeck: entitySummarySchema.nullable(),
  templateIndex: nonnegativeInteger,
  flags: z.number().int().min(0).max(7),
  modifiedAt: z.string(),
  scheduling: schedulingSchema,
});
export const searchPageSchema = z.strictObject({
  ids: z.array(entityIdSchema),
  nextCursor: z.string().nullable(),
});
export const noteTypeSchema = z.object({
  id: entityIdSchema,
  name: z.string(),
  kind: z.enum(['normal', 'cloze']),
  fields: z.array(z.object({ name: z.string() })),
  templates: z.array(
    z.object({
      name: z.string(),
      questionHtml: z.string(),
      answerHtml: z.string(),
    }),
  ),
});
export const ackSchema = z.strictObject({ changed: z.boolean() });

/** AV-003 uses safe numeric IDs; never silently round the v1 decimal-string IDs. */
export function toContractId(id: string): number {
  entityIdSchema.parse(id);
  const value = Number(id);
  if (!Number.isSafeInteger(value) || String(value) !== id)
    throw new Error('Anki ID exceeds the current safe numeric contract.');
  return value;
}
