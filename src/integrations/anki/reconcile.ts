import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  approvalRecordSchema,
  checkExpectedRevision,
  deliveryReceiptSchema,
  directDestinationSchema,
  revisionRefSchema,
  type ApprovalRecord,
  type DeliveryReceipt,
} from '../../shared/contracts';
import { AnkiConnectClient } from './client';
import {
  cardSchema,
  collectionSchema,
  deckSchema,
  entityIdSchema,
  noteCreatedSchema,
  noteSchema,
  searchPageSchema,
  toContractId,
} from './schemas';

export const pairingSchema = z.strictObject({
  collectionPairId: z.string().uuid(),
  profile: z.string().min(1),
  session: z.string().min(1),
  mode: z.literal('direct'),
});
export const intentSchema = z.strictObject({
  pairing: pairingSchema,
  destination: directDestinationSchema,
  draft: revisionRefSchema,
  modelId: entityIdSchema,
  modelName: z.string().regex(/^AV004_[a-f0-9]+$/),
});
export type DeliveryIntent = z.infer<typeof intentSchema>;

export function assertPairing(
  actual: z.infer<typeof collectionSchema>,
  expected: z.infer<typeof pairingSchema>,
): void {
  pairingSchema.parse(expected);
  if (
    actual.profile !== expected.profile ||
    actual.session !== expected.session
  )
    throw new Error(
      'Collection session changed; explicit re-pairing and reconciliation are required.',
    );
}

export async function findSourceNote(
  client: AnkiConnectClient,
  intent: DeliveryIntent,
) {
  const page = await client.call(
    'notes.search',
    {
      query: `note:${intent.modelName} AvSourceId:${intent.draft.sourceNoteId}`,
      limit: 2,
      session: intent.pairing.session,
    },
    searchPageSchema,
  );
  if (page.nextCursor !== null || page.ids.length > 1)
    throw new Error(
      'Source identity is ambiguous; no creation or update is allowed.',
    );
  const id = page.ids[0];
  if (!id) return null;
  const note = await client.call(
    'notes.get',
    { id, session: intent.pairing.session },
    noteSchema,
  );
  if (
    note.id !== id ||
    note.fields.AvSourceId !== intent.draft.sourceNoteId ||
    note.noteType.id !== intent.modelId ||
    note.cardIds.length !== 1
  ) {
    throw new Error(
      'Source identity or app-owned note type could not be reconciled.',
    );
  }
  return note;
}

/** Experiment only: caller persists intent BEFORE calling, and serializes calls. */
export async function deliverProbeNote(
  client: AnkiConnectClient,
  input: DeliveryIntent,
  approval: ApprovalRecord,
  fields: Readonly<{ Front: string; Back: string; Audio: string }>,
  audioArtifactIds: readonly string[],
  saveReceipt: (receipt: DeliveryReceipt) => Promise<void>,
  previousReceipt?: DeliveryReceipt,
): Promise<{
  disposition: 'created' | 'unchanged' | 'reconciled' | 'updated';
  receipt: DeliveryReceipt;
}> {
  const intent = intentSchema.parse(input);
  const approved = approvalRecordSchema.parse(approval);
  const payloadFields = z
    .strictObject({
      Front: z.string().min(1),
      Back: z.string().min(1),
      Audio: z.string().regex(/^\[sound:[a-zA-Z0-9_.-]+\.(wav|mp3)\]$/),
    })
    .parse(fields);
  const artifactIds = z.array(z.string().min(1)).min(1).parse(audioArtifactIds);
  previousReceipt = previousReceipt
    ? deliveryReceiptSchema.parse(previousReceipt)
    : undefined;
  if (checkExpectedRevision(intent.draft, approved.draft))
    throw new Error('Exact-revision approval is required.');
  if (intent.destination.collectionPairId !== intent.pairing.collectionPairId)
    throw new Error('Destination belongs to another pairing.');
  if (
    previousReceipt &&
    (previousReceipt.mode !== 'direct' ||
      previousReceipt.destination.collectionPairId !==
        intent.pairing.collectionPairId ||
      previousReceipt.draft.sourceNoteId !== intent.draft.sourceNoteId ||
      previousReceipt.draft.profile.id !== intent.draft.profile.id ||
      previousReceipt.draft.profile.version !== intent.draft.profile.version ||
      previousReceipt.draft.revision > intent.draft.revision)
  )
    throw new Error('Unsupported receipt identity or delivery-mode reuse.');
  if (
    previousReceipt?.mode === 'direct' &&
    previousReceipt.status === 'complete' &&
    String(previousReceipt.externalNoteTypeId) !== intent.modelId
  ) {
    throw new Error('Saved receipt refers to an incompatible note type.');
  }
  assertPairing(
    await client.call('collection.get', {}, collectionSchema),
    intent.pairing,
  );
  const decks = await client.call(
    'decks.list',
    { session: intent.pairing.session },
    z.array(deckSchema),
  );
  if (
    !decks.some(
      (deck) =>
        deck.id === String(intent.destination.deckId) &&
        deck.name === intent.destination.deckName &&
        deck.kind === 'normal',
    )
  ) {
    throw new Error('Selected destination is stale or unavailable.');
  }
  const note = await findSourceNote(client, intent);
  const desiredFields = {
    AvSourceId: intent.draft.sourceNoteId,
    ...payloadFields,
  };
  let noteId: string;
  let disposition: 'created' | 'unchanged' | 'reconciled' | 'updated';
  if (note) {
    if (
      previousReceipt?.mode === 'direct' &&
      previousReceipt.status === 'complete' &&
      String(previousReceipt.externalNoteId) !== note.id
    )
      throw new Error('Saved receipt conflicts with reconciled note.');
    for (const cardId of note.cardIds) {
      const card = await client.call(
        'cards.get',
        { id: cardId, session: intent.pairing.session },
        cardSchema,
      );
      if (
        card.id !== cardId ||
        card.noteId !== note.id ||
        card.deck.id !== String(intent.destination.deckId)
      )
        throw new Error(
          'Previously delivered card is in another deck; no silent move is allowed.',
        );
    }
    noteId = note.id;
    if (
      Object.entries(desiredFields).some(
        ([key, value]) => note.fields[key] !== value,
      )
    ) {
      const updated = await client.call(
        'notes.update',
        {
          id: note.id,
          patch: { fields: desiredFields },
          session: intent.pairing.session,
        },
        noteSchema,
        true,
      );
      if (
        updated.id !== note.id ||
        Object.entries(desiredFields).some(
          ([key, value]) => updated.fields[key] !== value,
        )
      ) {
        throw new Error(
          'Updated note could not be verified; reconcile before retrying.',
        );
      }
      disposition = 'updated';
    } else disposition = previousReceipt ? 'unchanged' : 'reconciled';
  } else {
    if (previousReceipt)
      throw new Error(
        'Previously delivered note could not be found; creation is blocked.',
      );
    const created = await client.call(
      'notes.create',
      {
        noteType: { id: intent.modelId },
        deck: { id: String(intent.destination.deckId) },
        fields: desiredFields,
        tags: ['av004-disposable'],
        session: intent.pairing.session,
      },
      noteCreatedSchema,
      true,
    );
    if (created.cardIds.length !== 1)
      throw new Error(
        'Unexpected card count after creation; reconcile before retrying.',
      );
    noteId = created.noteId;
    disposition = 'created';
  }
  const receipt = deliveryReceiptSchema.parse({
    receiptId: randomUUID(),
    draft: intent.draft,
    destination: intent.destination,
    mode: 'direct',
    status: 'complete',
    recordedAt: new Date().toISOString(),
    audioArtifactIds: artifactIds,
    externalNoteId: toContractId(noteId),
    externalNoteTypeId: toContractId(intent.modelId),
  });
  await saveReceipt(receipt);
  return { disposition, receipt };
}
