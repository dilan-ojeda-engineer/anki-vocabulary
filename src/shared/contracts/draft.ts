import { z } from 'zod';
import {
  idSchema,
  providerSettingsSchema,
  revisionRefSchema,
  sha256Schema,
  textSchema,
  timestampSchema,
} from './common';
import {
  createFieldValuesSchema,
  fieldValueSchema,
  generationProfileSchema,
  type GenerationProfile,
} from './profile';

export const vocabularyInputSchema = z
  .strictObject({
    inputId: idSchema,
    originalText: textSchema,
    target: textSchema,
    context: textSchema.nullable(),
    source: z.discriminatedUnion('kind', [
      z
        .strictObject({
          kind: z.literal('paste'),
          line: z.number().int().positive(),
        })
        .readonly(),
      z
        .strictObject({
          kind: z.enum(['text-file', 'csv']),
          name: textSchema,
          row: z.number().int().positive(),
        })
        .readonly(),
    ]),
  })
  .readonly();

export const correctionSchema = z
  .strictObject({
    original: textSchema,
    proposed: textSchema,
    reason: textSchema,
  })
  .readonly();

export const generationMetadataSchema = z
  .strictObject({
    origin: z.enum(['fixture', 'provider', 'manual']),
    providerId: idSchema.nullable(),
    modelId: textSchema.nullable(),
    settings: providerSettingsSchema,
    requestId: textSchema.nullable(),
    promptVersion: textSchema,
    promptHash: sha256Schema,
    createdAt: timestampSchema,
    latencyMs: z.number().finite().nonnegative().nullable(),
    usage: z
      .strictObject({
        inputTokens: z.number().int().nonnegative(),
        outputTokens: z.number().int().nonnegative(),
      })
      .readonly()
      .nullable(),
  })
  .superRefine((metadata, context) => {
    if (
      metadata.origin === 'provider' &&
      (!metadata.providerId || !metadata.modelId)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Provider generation requires provider and model identities.',
      });
    }
  })
  .readonly();

const cardDraftEnvelopeSchema = z.strictObject({
  ref: revisionRefSchema,
  input: vocabularyInputSchema,
  fields: z.record(z.string(), fieldValueSchema).readonly(),
  corrections: z.array(correctionSchema).readonly(),
  generation: generationMetadataSchema.nullable(),
});
/** Envelope validation alone does not establish profile-valid content. */
export const draftEnvelopeSchema = cardDraftEnvelopeSchema.readonly();

// Approval and media are separate records, never learning fields or draft flags.
export const approvalRecordSchema = z
  .strictObject({
    draft: revisionRefSchema,
    approvedAt: timestampSchema,
  })
  .readonly();

export const validationErrorSchema = z
  .strictObject({
    code: z.literal('VALIDATION_FAILED'),
    issues: z
      .array(
        z
          .strictObject({
            path: z.array(z.union([z.string(), z.number()])).readonly(),
            message: textSchema,
          })
          .readonly(),
      )
      .min(1)
      .readonly(),
  })
  .readonly();

export function toValidationError(error: z.ZodError): ValidationError {
  return validationErrorSchema.parse({
    code: 'VALIDATION_FAILED',
    issues: error.issues.map((issue) => ({
      path: issue.path.map((part) =>
        typeof part === 'symbol' ? String(part) : part,
      ),
      message: 'Value does not satisfy the contract.',
    })),
  });
}

export function createCardDraftSchema(profile: GenerationProfile) {
  const snapshot = generationProfileSchema.parse(profile);
  return cardDraftEnvelopeSchema
    .extend({ fields: createFieldValuesSchema(snapshot) })
    .superRefine((draft, context) => {
      if (
        draft.ref.profile.id !== snapshot.ref.id ||
        draft.ref.profile.version !== snapshot.ref.version
      ) {
        context.addIssue({
          code: 'custom',
          path: ['ref', 'profile'],
          message: 'Draft must match the immutable profile snapshot.',
        });
      }
      if (
        draft.generation &&
        draft.generation.promptVersion !== snapshot.prompt.version
      ) {
        context.addIssue({
          code: 'custom',
          path: ['generation', 'promptVersion'],
          message: 'Generation must identify the snapshot prompt version.',
        });
      }
    })
    .readonly();
}

export type VocabularyInput = z.infer<typeof vocabularyInputSchema>;
export type CardDraft = z.infer<typeof draftEnvelopeSchema>;
export type ApprovalRecord = z.infer<typeof approvalRecordSchema>;
export type ValidationError = z.infer<typeof validationErrorSchema>;
