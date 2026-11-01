import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseAnkiOptions } from './anki-options';
import { z } from 'zod';
import {
  approvalRecordSchema,
  deliveryReceiptSchema,
  directDestinationSchema,
} from '../shared/contracts';
import {
  AnkiConnectClient,
  AnkiConnectError,
  operationHandleSchema,
} from '../integrations/anki/client';
import {
  deliverProbeNote,
  assertPairing,
  findSourceNote,
  intentSchema,
  pairingSchema,
} from '../integrations/anki/reconcile';
import {
  ackSchema,
  cardSchema,
  collectionSchema,
  deckSchema,
  descriptionSchema,
  entityIdSchema,
  noteTypeSchema,
  toContractId,
} from '../integrations/anki/schemas';

const requiredMethods = [
  'collection.get',
  'decks.list',
  'decks.create',
  'noteTypes.create',
  'notes.search',
  'notes.get',
  'notes.create',
  'notes.update',
  'cards.get',
  'cards.render',
  'media.store',
  'media.get',
  'operations.get',
  'application.navigate',
  'reviewer.get',
  'reviewer.showAnswer',
  'reviewer.answer',
  'reviewer.playAudio',
];

async function writeJson(path: string, data: unknown): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(data, null, 2), { flag: 'wx' });
  await rename(temporary, path);
}

// Diagnostic PCM audio, not speech synthesis or a voice-quality evaluation.
function diagnosticTone(): Buffer {
  const rate = 16000;
  const samples = rate;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + samples * 2, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index++) {
    const fade = Math.min(1, index / 400, (samples - index) / 400);
    wav.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * 440 * index) / rate) * 5000 * fade),
      44 + index * 2,
    );
  }
  return wav;
}

async function main(): Promise<void> {
  const values = parseAnkiOptions();
  const client = new AnkiConnectClient(values.endpoint);
  const description = await client.call('api.describe', {}, descriptionSchema);
  const missing = requiredMethods.filter(
    (name) =>
      !description.methods.some(
        (method) => method.name === name && method.available,
      ),
  );
  if (missing.length)
    throw new Error(
      `Required AnkiConnect capabilities unavailable: ${missing.join(', ')}`,
    );
  const collection = await client.call('collection.get', {}, collectionSchema);
  const initialDecks = await client.call(
    'decks.list',
    { session: collection.session },
    z.array(deckSchema),
  );
  console.log(
    JSON.stringify(
      {
        ankiVersion: description.ankiVersion,
        apiMajor: description.apiMajor,
        profile: collection.profile,
        decks: initialDecks,
      },
      null,
      2,
    ),
  );
  if (!values.run && !values.resume && !values.preview) {
    console.log(
      'Read-only probe complete. Writes require --run --disposable-profile NAME.',
    );
    return;
  }
  if (
    !values['disposable-profile'] ||
    values['disposable-profile'] !== collection.profile
  )
    throw new Error(
      'The explicitly named disposable profile must match the active profile.',
    );

  const evidenceRoot = resolve('.tools/av004-evidence');
  if (values.preview) {
    const runId = values.preview;
    const saved = z
      .strictObject({ intent: intentSchema, approval: approvalRecordSchema })
      .parse(
        JSON.parse(
          await readFile(join(evidenceRoot, runId, 'intent.json'), 'utf8'),
        ) as unknown,
      );
    assertPairing(collection, saved.intent.pairing);
    const note = await findSourceNote(client, saved.intent);
    if (!note)
      throw new Error('No reconciled fixture note is available for preview.');
    // A read-only negative request verifies the real server's session guard.
    try {
      await client.call(
        'decks.list',
        { session: `stale-${collection.session}` },
        z.array(deckSchema),
      );
      throw new Error('The server accepted a stale collection session.');
    } catch (error) {
      if (
        !(error instanceof AnkiConnectError) ||
        error.remoteType !== 'staleSession'
      )
        throw error;
    }
    const browserState = z.strictObject({
      open: z.boolean(),
      selectedNoteIds: z.array(entityIdSchema),
      selectedCardIds: z.array(entityIdSchema),
    });
    const opened = await client.call(
      'browser.open',
      { query: `nid:${note.id}`, session: collection.session },
      operationHandleSchema,
    );
    await client.wait(opened, collection.session, browserState);
    const selected = await client.call(
      'browser.select',
      { noteIds: [note.id], session: collection.session },
      operationHandleSchema,
    );
    const state = await client.wait(selected, collection.session, browserState);
    if (!state.open || !state.selectedNoteIds.includes(note.id))
      throw new Error('Fixture note was not selected in the browser.');
    await writeJson(join(evidenceRoot, runId, 'preview-check.json'), {
      at: new Date().toISOString(),
      noteId: note.id,
      staleSessionRejected: true,
      selectedInBrowser: true,
    });
    console.log(
      'Fixture selected in Anki Browse. Click Preview and replay the front audio; this does not answer the card.',
    );
    return;
  }
  await mkdir(evidenceRoot, { recursive: true });
  const lockPath = join(evidenceRoot, 'experiment.lock');
  const runId = values.resume ?? randomUUID();
  const runDirectory = join(evidenceRoot, runId);
  let previousMethods: string[] = [];
  const lock = await open(lockPath, 'wx');
  try {
    if (!values.resume) await mkdir(runDirectory);
    if (existsSync(join(runDirectory, 'evidence.json')))
      throw new Error('This experiment is complete; do not replay its writes.');
    const saved = values.resume
      ? z
          .strictObject({
            intent: intentSchema,
            approval: approvalRecordSchema,
          })
          .parse(
            JSON.parse(
              await readFile(join(runDirectory, 'intent.json'), 'utf8'),
            ) as unknown,
          )
      : null;
    const previousReceipt = saved
      ? deliveryReceiptSchema.parse(
          JSON.parse(
            await readFile(join(runDirectory, 'receipt.json'), 'utf8'),
          ) as unknown,
        )
      : undefined;
    if (
      previousReceipt &&
      (previousReceipt.status !== 'complete' ||
        previousReceipt.draft.revision !== 1)
    )
      throw new Error(
        'Resume requires an already-reconciled revision-1 receipt.',
      );
    if (saved) {
      const failure = z
        .object({ methodsCalled: z.array(z.string()) })
        .parse(
          JSON.parse(
            await readFile(join(runDirectory, 'failure.json'), 'utf8'),
          ) as unknown,
        );
      previousMethods = failure.methodsCalled;
    }
    const pairing =
      saved?.intent.pairing ??
      pairingSchema.parse({
        collectionPairId: runId,
        profile: collection.profile,
        session: collection.session,
        mode: 'direct',
      });
    assertPairing(collection, pairing);
    const session = pairing.session;
    const deck = saved
      ? initialDecks.find(
          (item) =>
            item.id === String(saved.intent.destination.deckId) &&
            item.name === saved.intent.destination.deckName,
        )
      : await client.call(
          'decks.create',
          { name: `AV004::${runId.slice(0, 8)}`, session },
          deckSchema,
          true,
        );
    if (!deck) throw new Error('Resume destination is unavailable.');
    const discovered = await client.call(
      'decks.list',
      { session },
      z.array(deckSchema),
    );
    if (
      !discovered.some((item) => item.id === deck.id && item.name === deck.name)
    )
      throw new Error('Nested destination was not rediscovered.');
    const modelName =
      saved?.intent.modelName ?? `AV004_${runId.replaceAll('-', '')}`;
    const model = saved
      ? await client.call(
          'noteTypes.get',
          { noteType: { id: saved.intent.modelId }, session },
          noteTypeSchema,
        )
      : await client.call(
          'noteTypes.create',
          {
            name: modelName,
            kind: 'normal',
            fields: ['AvSourceId', 'Front', 'Back', 'Audio'].map((name) => ({
              name,
            })),
            templates: [
              {
                name: 'Probe',
                questionHtml: '{{Front}}<br>{{Audio}}',
                answerHtml: '{{Back}}',
              },
            ],
            sortField: 'Front',
            css: '.card { font-family: Arial; font-size: 24px; text-align: center; }',
            session,
          },
          noteTypeSchema,
          true,
        );
    if (
      model.fields.map((field) => field.name).join('|') !==
        'AvSourceId|Front|Back|Audio' ||
      model.templates.length !== 1
    )
      throw new Error('App-owned note type has an incompatible layout.');

    const intent =
      saved?.intent ??
      intentSchema.parse({
        pairing,
        modelId: model.id,
        modelName,
        destination: directDestinationSchema.parse({
          mode: 'direct',
          collectionPairId: runId,
          deckId: toContractId(deck.id),
          deckName: deck.name,
        }),
        draft: {
          sourceNoteId: `av004-${runId}`,
          revision: 1,
          profile: { id: 'anki-feasibility', version: '1' },
        },
      });
    const approval =
      saved?.approval ??
      approvalRecordSchema.parse({
        draft: intent.draft,
        approvedAt: new Date().toISOString(),
      });
    // Explicitly approved, controlled diagnostic fixture; not generated learner content.
    if (!saved)
      await writeJson(join(runDirectory, 'intent.json'), { intent, approval });
    const audio = diagnosticTone();
    const audioHash = createHash('sha256').update(audio).digest('hex');
    const filename = `av004-${runId}.wav`;
    await writeFile(join(runDirectory, filename), audio);
    const mediaHandle = saved
      ? null
      : await client.call(
          'media.store',
          {
            filename,
            source: { data: audio.toString('base64') },
            collision: 'error',
            session,
          },
          operationHandleSchema,
          true,
        );
    const stored = mediaHandle
      ? await client.wait(
          mediaHandle,
          session,
          z.strictObject({
            filename: z.string().min(1),
            status: z.literal('stored'),
            sha256: z.string(),
          }),
        )
      : { filename, sha256: audioHash, status: 'stored' };
    if (
      !/^[a-zA-Z0-9_.-]+\.wav$/.test(stored.filename) ||
      stored.sha256 !== audioHash
    )
      throw new Error('Stored media filename or checksum is invalid.');
    const media = await client.call(
      'media.get',
      { filename: stored.filename, session },
      z.strictObject({ filename: z.string(), data: z.string() }),
    );
    if (
      createHash('sha256')
        .update(Buffer.from(media.data, 'base64'))
        .digest('hex') !== audioHash
    )
      throw new Error('Media readback differs from the saved WAV.');
    const fields = {
      Front: 'AV-004 audio check: you should hear a short tone.',
      Back: 'Disposable integration fixture. No speech quality is asserted.',
      Audio: `[sound:${stored.filename}]`,
    };
    const artifacts = [`tone-${runId}`];
    if (saved) {
      const existing = await findSourceNote(client, intent);
      if (
        !existing ||
        Object.entries(fields).some(
          ([key, value]) => existing.fields[key] !== value,
        )
      )
        throw new Error(
          'Resume content differs from the controlled revision-1 fixture.',
        );
    }
    if (!saved) {
      let interrupted = false;
      try {
        await deliverProbeNote(
          client,
          intent,
          approval,
          fields,
          artifacts,
          async () => {
            interrupted = true;
            throw new Error('AV004_INJECTED_RECEIPT_LOSS');
          },
        );
      } catch (error) {
        if (
          !(error instanceof Error) ||
          error.message !== 'AV004_INJECTED_RECEIPT_LOSS'
        )
          throw error;
      }
      if (!interrupted)
        throw new Error('Receipt-loss checkpoint was not reached.');
    }
    const recoveredIntentData: unknown = JSON.parse(
      await readFile(join(runDirectory, 'intent.json'), 'utf8'),
    );
    const recovered = z
      .strictObject({ intent: intentSchema, approval: approvalRecordSchema })
      .parse(recoveredIntentData);
    const receiptPath = join(runDirectory, 'receipt.json');
    const saveReceipt = (receipt: unknown) => writeJson(receiptPath, receipt);
    const reconciled = await deliverProbeNote(
      client,
      recovered.intent,
      recovered.approval,
      fields,
      artifacts,
      saveReceipt,
      previousReceipt,
    );
    if (reconciled.disposition !== (saved ? 'unchanged' : 'reconciled'))
      throw new Error('Receipt recovery did not reconcile the existing note.');
    const receipt = deliveryReceiptSchema.parse(
      JSON.parse(await readFile(receiptPath, 'utf8')) as unknown,
    );
    const repeated = await deliverProbeNote(
      client,
      intent,
      approval,
      fields,
      artifacts,
      saveReceipt,
      receipt,
    );
    if (repeated.disposition !== 'unchanged')
      throw new Error('Repeat delivery was not idempotent.');
    const note = await findSourceNote(client, intent);
    if (!note) throw new Error('Reconciled note missing.');
    const cardId = note.cardIds[0];
    if (!cardId) throw new Error('Card missing.');
    const rendered = await client.call(
      'cards.render',
      { id: cardId, session },
      z.strictObject({
        cardId: entityIdSchema,
        questionHtml: z.string(),
        answerHtml: z.string(),
        css: z.string(),
      }),
    );
    const navigate = await client.call(
      'application.navigate',
      { view: 'review', deck: { id: deck.id }, session },
      operationHandleSchema,
      true,
    );
    await client.wait(navigate, session, ackSchema);
    const reviewerSchema = z.object({
      active: z.boolean(),
      card: cardSchema.nullable(),
      side: z.enum(['question', 'answer', 'none']),
      stateToken: z.string().nullable(),
      answers: z.array(
        z.object({ rating: z.enum(['again', 'hard', 'good', 'easy']) }),
      ),
    });
    const question = await client.call(
      'reviewer.get',
      { session },
      reviewerSchema,
    );
    if (
      !question.active ||
      question.card?.id !== cardId ||
      !question.stateToken
    )
      throw new Error('Expected test card is not active in the reviewer.');
    const playback = await client.call(
      'reviewer.playAudio',
      { stateToken: question.stateToken, session },
      ackSchema,
    );
    // Let the one-second tone finish before switching sides clears playback.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await client.call(
      'reviewer.showAnswer',
      { stateToken: question.stateToken, session },
      ackSchema,
    );
    const answer = await client.call(
      'reviewer.get',
      { session },
      reviewerSchema,
    );
    if (
      answer.side !== 'answer' ||
      !answer.stateToken ||
      !answer.answers.some((item) => item.rating === 'good')
    )
      throw new Error(
        'Native reviewer is not ready to accept the offered Good rating.',
      );
    const answerHandle = await client.call(
      'reviewer.answer',
      { stateToken: answer.stateToken, rating: 'good', session },
      operationHandleSchema,
      true,
    );
    await client.wait(
      answerHandle,
      session,
      z.object({ cardId: entityIdSchema, reviewId: entityIdSchema.nullable() }),
    );
    const before = await client.call(
      'cards.get',
      { id: cardId, session },
      cardSchema,
    );
    if (before.scheduling.repetitions < 1)
      throw new Error('The card was not actually studied.');
    const revisedIntent = intentSchema.parse({
      ...intent,
      draft: { ...intent.draft, revision: 2 },
    });
    const revisedApproval = approvalRecordSchema.parse({
      draft: revisedIntent.draft,
      approvedAt: new Date().toISOString(),
    });
    const updated = await deliverProbeNote(
      client,
      revisedIntent,
      revisedApproval,
      {
        ...fields,
        Back: 'Updated after study; the note, card, deck, and scheduling must remain stable.',
      },
      artifacts,
      saveReceipt,
      receipt,
    );
    if (updated.disposition !== 'updated')
      throw new Error('Approved revision was not updated.');
    const after = await client.call(
      'cards.get',
      { id: cardId, session },
      cardSchema,
    );
    if (
      before.id !== after.id ||
      before.noteId !== after.noteId ||
      before.deck.id !== after.deck.id ||
      JSON.stringify(before.scheduling) !== JSON.stringify(after.scheduling)
    )
      throw new Error(
        'Scheduling or note/card identity changed during content update.',
      );
    const finalNote = await findSourceNote(client, revisedIntent);
    if (finalNote?.id !== note.id)
      throw new Error('Final source identity differs.');
    const evidence = {
      runId,
      testedAt: new Date().toISOString(),
      endpoint: client.endpoint,
      ankiVersion: description.ankiVersion,
      // api.describe does not expose the source revision; never infer it from v1.
      addonRevisionDeclaredByOperator: values['addon-revision'] ?? null,
      apiMajor: description.apiMajor,
      pairing,
      nestedDestination: intent.destination,
      appOwnedModel: { id: model.id, name: modelName },
      sourceNoteId: intent.draft.sourceNoteId,
      noteId: note.id,
      cardId,
      audio: {
        filename: stored.filename,
        sha256: audioHash,
        readbackVerified: true,
        playbackRequestChanged: playback.changed,
        audibleConfirmation: 'pending-human-check',
        kind: 'diagnostic-tone-not-speech',
      },
      receiptLoss: {
        injectedAfterExternalCreation: true,
        persistedIntentReloaded: true,
        reconciledDisposition: saved
          ? 'reconciled-before-resume'
          : reconciled.disposition,
        resumedAfterNavigationSchemaFailure: Boolean(saved),
      },
      repeatDisposition: repeated.disposition,
      updateDisposition: updated.disposition,
      notesCreateRequests: [...previousMethods, ...client.requestLog].filter(
        (method) => method === 'notes.create',
      ).length,
      notesUpdateRequests: [...previousMethods, ...client.requestLog].filter(
        (method) => method === 'notes.update',
      ).length,
      matchingNotesAfter: finalNote ? 1 : 0,
      schedulingBefore: before.scheduling,
      schedulingAfter: after.scheduling,
      schedulingUnchanged: true,
      renderedCardReturned: rendered.cardId === cardId,
    };
    if (
      evidence.notesCreateRequests !== 1 ||
      evidence.notesUpdateRequests !== 1
    )
      throw new Error('Unexpected create/update request counts.');
    await writeJson(join(runDirectory, 'evidence.json'), evidence);
    console.log(JSON.stringify(evidence, null, 2));
    console.log(`Evidence saved under ${runDirectory}`);
  } catch (error) {
    if (
      existsSync(runDirectory) &&
      !existsSync(join(runDirectory, 'evidence.json'))
    )
      await writeJson(join(runDirectory, 'failure.json'), {
        at: new Date().toISOString(),
        message:
          error instanceof Error ? error.message : 'Unknown experiment failure',
        methodsCalled: [...previousMethods, ...client.requestLog],
        ...(error instanceof AnkiConnectError
          ? {
              code: error.code,
              mayHaveCommitted: error.mayHaveCommitted,
              remoteType: error.remoteType,
              operationId: error.operationId,
            }
          : {}),
      });
    throw error;
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Anki feasibility probe failed.',
  );
  if (error instanceof AnkiConnectError)
    console.error(
      JSON.stringify({
        code: error.code,
        mayHaveCommitted: error.mayHaveCommitted,
        remoteType: error.remoteType,
        operationId: error.operationId,
      }),
    );
  process.exitCode = 1;
});
