import { z } from 'zod';
import {
  idSchema,
  positiveIntegerSchema,
  revisionRefSchema,
  textSchema,
  timestampSchema,
} from './common';

export const directDestinationSchema = z
  .strictObject({
    mode: z.literal('direct'),
    collectionPairId: idSchema,
    deckId: positiveIntegerSchema,
    deckName: textSchema,
  })
  .readonly();

export const packageDestinationSchema = z
  .strictObject({
    mode: z.literal('package'),
    deckId: positiveIntegerSchema,
    deckName: textSchema,
  })
  .readonly();

export const deckDestinationSchema = z.discriminatedUnion('mode', [
  directDestinationSchema,
  packageDestinationSchema,
]);

const receiptBase = {
  receiptId: idSchema,
  draft: revisionRefSchema,
  audioArtifactIds: z.array(idSchema).readonly(),
  recordedAt: timestampSchema,
};

export const deliveryReceiptSchema = z.union([
  z
    .strictObject({
      ...receiptBase,
      mode: z.literal('direct'),
      status: z.literal('complete'),
      destination: directDestinationSchema,
      externalNoteId: positiveIntegerSchema,
      externalNoteTypeId: positiveIntegerSchema,
    })
    .readonly(),
  z
    .strictObject({
      ...receiptBase,
      mode: z.literal('direct'),
      status: z.literal('ambiguous'),
      destination: directDestinationSchema,
      requestId: textSchema.nullable(),
      externalNoteId: positiveIntegerSchema.nullable(),
    })
    .readonly(),
  z
    .strictObject({
      ...receiptBase,
      mode: z.literal('package'),
      status: z.literal('complete'),
      destination: packageDestinationSchema,
      packageArtifactId: idSchema,
      noteGuid: textSchema,
      noteTypeId: positiveIntegerSchema,
    })
    .readonly(),
]);

export type DeckDestination = z.infer<typeof deckDestinationSchema>;
export type DeliveryReceipt = z.infer<typeof deliveryReceiptSchema>;
