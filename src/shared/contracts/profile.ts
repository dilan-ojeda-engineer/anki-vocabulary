import { z } from 'zod';
import {
  fieldKeySchema,
  idSchema,
  positiveIntegerSchema,
  profileRefSchema,
  textSchema,
} from './common';

const fieldBase = {
  key: fieldKeySchema,
  label: textSchema,
  required: z.boolean(),
};
const fieldDefinitionSchema = z.discriminatedUnion('kind', [
  z
    .strictObject({
      ...fieldBase,
      kind: z.literal('text'),
      nullable: z.boolean(),
    })
    .readonly(),
  z
    .strictObject({
      ...fieldBase,
      kind: z.literal('text-list'),
      minItems: z.number().int().nonnegative(),
      maxItems: positiveIntegerSchema,
    })
    .refine((field) => field.minItems <= field.maxItems, 'Invalid list bounds.')
    .readonly(),
]);

const fieldBlockSchema = z
  .strictObject({
    kind: z.literal('field'),
    fieldKey: fieldKeySchema,
    heading: textSchema.nullable(),
    format: z.enum(['plain', 'quoted']),
    omitWhenNull: z.boolean(),
  })
  .readonly();

const layoutBlockSchema = z.discriminatedUnion('kind', [
  fieldBlockSchema,
  z.strictObject({ kind: z.literal('text'), text: textSchema }).readonly(),
  z
    .strictObject({
      kind: z.literal('group'),
      heading: textSchema,
      fields: z.array(fieldBlockSchema).min(1).readonly(),
    })
    .readonly(),
]);

export const generationProfileSchema = z
  .strictObject({
    ref: profileRefSchema,
    name: textSchema,
    prompt: z
      .strictObject({
        version: textSchema,
        text: textSchema,
        source: z
          .strictObject({
            kind: z.enum(['fixture', 'archived-user-prompt']),
            reference: textSchema,
          })
          .readonly(),
      })
      .readonly(),
    fields: z.array(fieldDefinitionSchema).min(1).readonly(),
    layout: z
      .strictObject({
        front: z.array(layoutBlockSchema).min(1).readonly(),
        back: z.array(layoutBlockSchema).min(1).readonly(),
      })
      .readonly(),
    audioSelectors: z
      .array(
        z
          .strictObject({
            fieldKey: fieldKeySchema,
            kind: z.enum(['text', 'text-list']),
            side: z.enum(['front', 'back']),
          })
          .readonly(),
      )
      .readonly(),
    noteType: z
      .strictObject({ key: idSchema, layoutVersion: positiveIntegerSchema })
      .readonly(),
  })
  .superRefine((profile, context) => {
    const definitions = new Map(
      profile.fields.map((field) => [field.key, field]),
    );
    if (definitions.size !== profile.fields.length) {
      context.addIssue({
        code: 'custom',
        path: ['fields'],
        message: 'Field keys must be unique.',
      });
    }
    const sides = { front: new Set<string>(), back: new Set<string>() };
    for (const side of ['front', 'back'] as const) {
      for (const [index, block] of profile.layout[side].entries()) {
        const fields =
          block.kind === 'group'
            ? block.fields
            : block.kind === 'field'
              ? [block]
              : [];
        for (const field of fields) {
          if (!definitions.has(field.fieldKey))
            context.addIssue({
              code: 'custom',
              path: ['layout', side, index],
              message: 'Layout references an undeclared field.',
            });
          sides[side].add(field.fieldKey);
        }
      }
    }
    for (const [index, field] of profile.fields.entries()) {
      if (!sides.front.has(field.key) && !sides.back.has(field.key))
        context.addIssue({
          code: 'custom',
          path: ['fields', index],
          message: 'Field has no visible layout placement.',
        });
    }
    const selected = new Set<string>();
    for (const [index, selector] of profile.audioSelectors.entries()) {
      const definition = definitions.get(selector.fieldKey);
      if (
        !definition ||
        definition.kind !== selector.kind ||
        !sides[selector.side].has(selector.fieldKey)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['audioSelectors', index],
          message: 'Audio selector must match a field on its displayed side.',
        });
      }
      if (selected.has(selector.fieldKey))
        context.addIssue({
          code: 'custom',
          path: ['audioSelectors', index],
          message: 'Field is selected for audio more than once.',
        });
      selected.add(selector.fieldKey);
    }
  })
  .readonly();

export type GenerationProfile = z.infer<typeof generationProfileSchema>;
export type FieldDefinition = GenerationProfile['fields'][number];

export const fieldValueSchema = z.union([
  textSchema,
  z.array(textSchema).readonly(),
  z.null(),
]);
export type FieldValue = z.infer<typeof fieldValueSchema>;
export type FieldValues = Readonly<Record<string, FieldValue>>;

/** The snapshot is authoritative; arbitrary provider keys are never accepted. */
export function createFieldValuesSchema(profile: GenerationProfile) {
  const snapshot = generationProfileSchema.parse(profile);
  const shape: Record<string, z.ZodType<FieldValue | undefined>> = {};
  for (const field of snapshot.fields) {
    let schema: z.ZodType<FieldValue | undefined> =
      field.kind === 'text'
        ? field.nullable
          ? textSchema.nullable()
          : textSchema
        : z
            .array(textSchema)
            .min(field.minItems)
            .max(field.maxItems)
            .readonly();
    if (!field.required) schema = schema.optional();
    shape[field.key] = schema;
  }
  return z
    .strictObject(shape)
    .transform((fields): FieldValues =>
      Object.freeze(
        Object.fromEntries(
          Object.entries(fields).filter(
            (entry): entry is [string, FieldValue] => entry[1] !== undefined,
          ),
        ),
      ),
    );
}
