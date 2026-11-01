import { z } from 'zod';

export const textSchema = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: 'Text must contain a non-whitespace character.',
  });
export const idSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
export const positiveIntegerSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
export const timestampSchema = z.iso.datetime({ offset: true });
export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export const providerSettingsSchema = z
  .record(idSchema, z.union([z.string(), z.number().finite(), z.boolean()]))
  .readonly();

export const profileRefSchema = z
  .strictObject({
    id: idSchema,
    version: textSchema,
  })
  .readonly();

export const revisionRefSchema = z
  .strictObject({
    sourceNoteId: idSchema,
    revision: positiveIntegerSchema,
    profile: profileRefSchema,
  })
  .readonly();

export const fieldKeySchema = z
  .string()
  .regex(/^[a-z][a-zA-Z0-9]*$/)
  .refine(
    (key) => !['constructor', 'prototype', '__proto__'].includes(key),
    'Reserved field key.',
  );

export const fieldEntryRefSchema = z.discriminatedUnion('kind', [
  z
    .strictObject({ kind: z.literal('text'), fieldKey: fieldKeySchema })
    .readonly(),
  z
    .strictObject({
      kind: z.literal('list-item'),
      fieldKey: fieldKeySchema,
      index: z.number().int().nonnegative(),
    })
    .readonly(),
]);

export type ProfileRef = z.infer<typeof profileRefSchema>;
export type RevisionRef = z.infer<typeof revisionRefSchema>;
export type FieldEntryRef = z.infer<typeof fieldEntryRefSchema>;
