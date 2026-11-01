import { z } from 'zod';
import { idSchema, revisionRefSchema, type RevisionRef } from './common';
import { validationErrorSchema } from './draft';
import { fieldValueSchema } from './profile';

const commandBase = { requestId: idSchema, expected: revisionRefSchema };
export const approvalCommandSchema = z
  .strictObject({ type: z.literal('draft.approve'), ...commandBase })
  .readonly();
export const draftCommandSchema = z.discriminatedUnion('type', [
  approvalCommandSchema,
  z
    .strictObject({
      type: z.literal('draft.edit'),
      ...commandBase,
      fields: z.record(z.string(), fieldValueSchema).readonly(),
    })
    .readonly(),
  z
    .strictObject({ type: z.literal('draft.reject'), ...commandBase })
    .readonly(),
  z
    .strictObject({ type: z.literal('draft.regenerate'), ...commandBase })
    .readonly(),
]);

export const revisionConflictSchema = z
  .strictObject({
    code: z.enum(['STALE_REVISION', 'PROFILE_MISMATCH', 'IDENTITY_MISMATCH']),
    expected: revisionRefSchema,
    current: revisionRefSchema,
  })
  .readonly();

export const commandErrorSchema = z.union([
  validationErrorSchema,
  revisionConflictSchema,
]);
export const commandReplySchema = z.discriminatedUnion('status', [
  z
    .strictObject({
      status: z.literal('ok'),
      requestId: idSchema,
      revision: revisionRefSchema,
    })
    .readonly(),
  z
    .strictObject({
      status: z.literal('error'),
      requestId: idSchema,
      error: commandErrorSchema,
    })
    .readonly(),
]);

/** Pure comparison only; authorization, atomic updates, and jobs belong to AV-013. */
export function checkExpectedRevision(
  expected: RevisionRef,
  current: RevisionRef,
): RevisionConflict | null {
  const a = revisionRefSchema.parse(expected);
  const b = revisionRefSchema.parse(current);
  const code =
    a.sourceNoteId !== b.sourceNoteId
      ? 'IDENTITY_MISMATCH'
      : a.profile.id !== b.profile.id || a.profile.version !== b.profile.version
        ? 'PROFILE_MISMATCH'
        : a.revision !== b.revision
          ? 'STALE_REVISION'
          : null;
  return code
    ? revisionConflictSchema.parse({ code, expected: a, current: b })
    : null;
}

export type ApprovalCommand = z.infer<typeof approvalCommandSchema>;
export type DraftCommand = z.infer<typeof draftCommandSchema>;
export type RevisionConflict = z.infer<typeof revisionConflictSchema>;
export type CommandReply = z.infer<typeof commandReplySchema>;
export type DraftCommandHandler = (
  command: DraftCommand,
) => Promise<CommandReply>;
