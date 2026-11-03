import { z } from 'zod';
import { coachFieldSchema } from './card-display';

export const audioPlacementIdSchema = z.union([
  z.literal('target'),
  z.literal('frontExample'),
  z.string().regex(/^examples:[0-9]+$/),
]);

export const audioItemSchema = z.strictObject({
  placementId: audioPlacementIdSchema,
  fieldKey: z.enum(['target', 'frontExample', 'examples']),
  itemIndex: z.number().int().nonnegative().nullable(),
  side: z.enum(['front', 'back']),
  sourceText: z.string().min(1),
  text: z.string(),
  characterCount: z.number().int().nonnegative(),
  status: z.enum(['missing', 'current', 'stale', 'invalid']),
});

export const audioPlanSchema = z.strictObject({
  cardId: z.uuid(),
  revision: z.number().int().positive(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  items: z.array(audioItemSchema),
});

export const audioSelectionRequestSchema = z.strictObject({
  expectedRevision: z.number().int().positive(),
  expectedContentHash: z.string().regex(/^[a-f0-9]{64}$/),
  placementIds: z.array(audioPlacementIdSchema),
});

export type AudioPlan = z.infer<typeof audioPlanSchema>;
export type AudioSelectionRequest = z.infer<typeof audioSelectionRequestSchema>;

function speechText(sourceText: string): string {
  return sourceText
    .trim()
    .replace(/\*\*/g, '')
    .trim()
    .replace(/^[“"]|[”"]$/g, '')
    .trim();
}

/** Extract only the av005-5 fields approved for speech. Words are not corrected. */
export function extractAudioItems(fields: unknown): AudioPlan['items'] {
  const validated = coachFieldSchema.parse(fields);
  const examples = validated.examples as string[];
  const entries = [
    {
      placementId: 'target',
      fieldKey: 'target',
      itemIndex: null,
      side: 'front',
      sourceText: validated.target as string,
    },
    {
      placementId: 'frontExample',
      fieldKey: 'frontExample',
      itemIndex: null,
      side: 'front',
      sourceText: validated.frontExample as string,
    },
    ...examples.map((sourceText, itemIndex) => ({
      placementId: `examples:${itemIndex}`,
      fieldKey: 'examples',
      itemIndex,
      side: 'back',
      sourceText,
    })),
  ];
  return entries.map((entry) => {
    const text = speechText(entry.sourceText);
    return audioItemSchema.parse({
      ...entry,
      text,
      characterCount: [...text].length,
      status: text ? 'missing' : 'invalid',
    });
  });
}
