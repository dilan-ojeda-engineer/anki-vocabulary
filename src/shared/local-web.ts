import { z } from 'zod';

export const publicDeckSchema = z.strictObject({
  id: z.string().regex(/^[1-9][0-9]*$/),
  name: z.string().min(1),
  kind: z.enum(['normal', 'filtered']),
});

const unavailableAnkiSchema = z.strictObject({
  status: z.literal('unavailable'),
  reason: z.enum([
    'not-running-or-unreachable',
    'unsupported-or-invalid-response',
    'request-rejected',
  ]),
});

const connectedAnkiSchema = z.strictObject({
  status: z.literal('connected'),
  ankiVersion: z.string().min(1),
  profile: z.string().min(1),
  decks: z.array(publicDeckSchema).readonly(),
});

export const localWebStatusSchema = z.strictObject({
  server: z.strictObject({ status: z.literal('ready') }),
  anki: z.discriminatedUnion('status', [
    unavailableAnkiSchema,
    connectedAnkiSchema,
  ]),
});

export type LocalWebStatus = z.infer<typeof localWebStatusSchema>;
