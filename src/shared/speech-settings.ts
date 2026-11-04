import { z } from 'zod';

export const speechKeySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{10,512}$/);
export const speechSettingsRequestSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('save'), key: speechKeySchema }),
  z.strictObject({ action: z.literal('check') }),
  z.strictObject({ action: z.literal('remove') }),
]);
export const speechSettingsSchema = z.strictObject({
  configured: z.boolean(),
  source: z.enum(['saved', 'session']).nullable(),
  storageAvailable: z.boolean(),
  state: z.enum(['missing', 'unchecked', 'checking', 'ready', 'blocked']),
  issue: z
    .enum([
      'storage-unavailable',
      'credential-unreadable',
      'account-access-denied',
      'account-rate-limited',
      'account-unavailable',
      'free-allowance-unavailable',
    ])
    .nullable(),
  checkedAt: z.iso.datetime().nullable(),
  allowance: z
    .strictObject({
      tier: z.string().max(80),
      used: z.number().nonnegative(),
      limit: z.number().nonnegative(),
    })
    .nullable(),
});
export type SpeechSettings = z.infer<typeof speechSettingsSchema>;
export type SpeechSettingsRequest = z.infer<typeof speechSettingsRequestSchema>;
