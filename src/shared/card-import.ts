import { z } from 'zod';

export const importFormatSchema = z.enum(['paste', 'json', 'csv', 'tsv']);
export const importRequestSchema = z.strictObject({
  format: importFormatSchema,
  text: z.string().min(1).max(2_000_000),
});
export const importIssueSchema = z.strictObject({
  path: z.string(),
  message: z.string(),
});
export const importEntrySchema = z.strictObject({
  index: z.number().int().positive(),
  originalText: z.string(),
  fields: z.record(z.string(), z.unknown()).nullable(),
  issues: z.array(importIssueSchema),
});
export const importPreviewSchema = z.strictObject({
  entries: z.array(importEntrySchema),
});
export const savedCardSchema = z.strictObject({
  id: z.uuid(),
  profileVersion: z.literal('av005-5'),
  originalText: z.string(),
  originalFields: z.record(z.string(), z.unknown()),
  fields: z.record(z.string(), z.unknown()),
  included: z.boolean(),
  revision: z.number().int().positive(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  approval: z
    .strictObject({
      revision: z.number().int().positive(),
      contentHash: z.string().regex(/^[a-f0-9]{64}$/),
      approvedAt: z.iso.datetime(),
    })
    .nullable(),
  importedAt: z.iso.datetime(),
});
export const workspaceSchema = z.strictObject({
  version: z.literal(3),
  cards: z.array(savedCardSchema),
});
export const approveCardRequestSchema = z.strictObject({
  expectedRevision: z.number().int().positive(),
  expectedContentHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export const updateCardRequestSchema = z.strictObject({
  expectedRevision: z.number().int().positive(),
  fields: z.record(z.string(), z.unknown()),
  included: z.boolean(),
});
export type ImportRequest = z.infer<typeof importRequestSchema>;
export type ImportPreview = z.infer<typeof importPreviewSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type UpdateCardRequest = z.infer<typeof updateCardRequestSchema>;
export type ApproveCardRequest = z.infer<typeof approveCardRequestSchema>;
