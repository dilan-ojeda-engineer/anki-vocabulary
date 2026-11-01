import { z } from 'zod';
import {
  fieldEntryRefSchema,
  idSchema,
  providerSettingsSchema,
  revisionRefSchema,
  sha256Schema,
  textSchema,
} from './common';

export const speechConfigurationSchema = z
  .strictObject({
    providerId: idSchema,
    modelId: textSchema.nullable(),
    modelVersion: textSchema.nullable(),
    voiceId: textSchema,
    voiceVersion: textSchema.nullable(),
    settings: providerSettingsSchema,
    format: z.enum(['mp3', 'wav']),
  })
  .readonly();

export const speechRequestSchema = z
  .strictObject({
    requestId: idSchema,
    draft: revisionRefSchema,
    field: fieldEntryRefSchema,
    text: textSchema,
    configuration: speechConfigurationSchema,
  })
  .readonly();

/** Worker-side record: localPath is not a renderer command argument. */
export const audioArtifactSchema = z
  .strictObject({
    artifactId: idSchema,
    request: speechRequestSchema,
    cacheKey: sha256Schema,
    contentHash: sha256Schema,
    localPath: textSchema,
  })
  .readonly();

export const audioAssociationSchema = z
  .strictObject({
    draft: revisionRefSchema,
    field: fieldEntryRefSchema,
    artifactId: idSchema,
  })
  .readonly();

export const providerErrorSchema = z
  .strictObject({
    kind: z.enum([
      'configuration',
      'authentication',
      'quota',
      'temporary-service',
      'unsupported-capability',
      'content',
      'timeout',
    ]),
    message: textSchema,
    requestId: textSchema.nullable(),
    retryAfterMs: z.number().finite().nonnegative().nullable(),
    allowanceMayHaveBeenConsumed: z.boolean(),
  })
  .readonly();

export type SpeechConfiguration = z.infer<typeof speechConfigurationSchema>;
export type SpeechRequest = z.infer<typeof speechRequestSchema>;
export type AudioArtifact = z.infer<typeof audioArtifactSchema>;
export type AudioAssociation = z.infer<typeof audioAssociationSchema>;
export type ProviderError = z.infer<typeof providerErrorSchema>;
