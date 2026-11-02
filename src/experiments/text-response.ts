import { z } from 'zod';
import {
  createFieldValuesSchema,
  generationProfileSchema,
  correctionSchema,
  type GenerationProfile,
} from '../shared/contracts';

/** Profile-derived transport schema; structural success never implies approval. */
export function createTextResponseSchema(profile: GenerationProfile) {
  return z.strictObject({
    fields: createFieldValuesSchema(profile),
    corrections: z.array(correctionSchema),
  });
}

/** JSON Schema uses the same field definitions as runtime validation. */
export function createTextJsonSchema(profile: GenerationProfile) {
  const snapshot = generationProfileSchema.parse(profile);
  const properties = Object.fromEntries(
    snapshot.fields.map((field) => [
      field.key,
      field.kind === 'text'
        ? { type: field.nullable ? ['string', 'null'] : 'string', minLength: 1 }
        : {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            minItems: field.minItems,
            maxItems: field.maxItems,
          },
    ]),
  );
  if (snapshot.fields.some((field) => !field.required)) {
    throw new Error(
      'This experiment requires explicit required fields; optional-profile transport is deferred.',
    );
  }
  return {
    type: 'object',
    additionalProperties: false,
    required: ['fields', 'corrections'],
    properties: {
      fields: {
        type: 'object',
        additionalProperties: false,
        required: snapshot.fields.map((field) => field.key),
        properties,
      },
      corrections: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['original', 'proposed', 'reason'],
          properties: {
            original: { type: 'string', minLength: 1 },
            proposed: { type: 'string', minLength: 1 },
            reason: { type: 'string', minLength: 1 },
          },
        },
      },
    },
  };
}

export function validateTextResponse(
  profile: GenerationProfile,
  content: string,
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { status: 'invalid-json' as const, issues: [] };
  }
  const result = createTextResponseSchema(profile).safeParse(parsed);
  if (!result.success)
    return {
      status: 'invalid-fields' as const,
      issues: result.error.issues.map((issue) => ({
        path: issue.path.map(String),
        code: issue.code,
      })),
    };
  return {
    status: 'structurally-valid' as const,
    value: result.data,
    linguisticReview: 'pending' as const,
  };
}
