import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import {
  AnkiConnectClient,
  AnkiConnectError,
} from '../integrations/anki/client';
import {
  cardSchema,
  noteSchema,
  descriptionSchema,
} from '../integrations/anki/schemas';
import {
  ankiFields,
  ankiFieldNames,
  sourceFields,
  audioFieldName,
} from './anki-template';
import { DeliveryService, deliveryRecordSchema } from './delivery-service';
import type { DeliveryRecord, OwnedNoteContext } from './delivery-service';
import { AudioService } from './audio-service';
import { WorkspaceStore, contentHash } from './workspace';
import { coachFieldSchema, coachFields } from '../shared/card-display';
import { extractAudioItems } from '../shared/audio-plan';
import { noteUpdateResultSchema } from '../shared/note-update';
import type {
  NoteLoaded,
  NoteUpdateRequest,
  NoteUpdatePreview,
  NoteUpdateResult,
} from '../shared/note-update';
import type { Workspace } from '../shared/card-import';

type Note = z.infer<typeof noteSchema>;
type Card = Workspace['cards'][number];
type Snapshot = { note: Note; cards: z.infer<typeof cardSchema>[] };
const snapshotSchema = z.strictObject({
  note: noteSchema,
  cards: z.array(cardSchema),
});
const entrySchema = noteUpdateResultSchema.extend({
  deckId: z.string(),
  profile: z.string(),
  modelId: z.string(),
  before: snapshotSchema,
  after: z.record(z.string(), z.string()),
  receipt: deliveryRecordSchema,
});
type Entry = z.infer<typeof entrySchema>;
const journalSchema = z.strictObject({
  version: z.literal(1),
  entries: z.array(entrySchema),
});
const digest = (value: unknown): string => {
  const canonical = (input: unknown): unknown =>
    Array.isArray(input)
      ? input.map(canonical)
      : input && typeof input === 'object'
        ? Object.fromEntries(
            Object.entries(input)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, val]) => [key, canonical(val)]),
          )
        : input;
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
};
const checksum = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
const publicResult = (entry: Entry): NoteUpdateResult =>
  noteUpdateResultSchema.strip().parse(entry);
const audioCount = (fields: Record<string, string>) =>
  Object.entries(fields).filter(
    ([key, value]) => key.startsWith('Audio') && value,
  ).length;
const schedulingIdentity = (snapshot: Snapshot) =>
  snapshot.cards.map((card) => ({
    id: card.id,
    noteId: card.noteId,
    deck: card.deck,
    homeDeck: card.homeDeck,
    templateIndex: card.templateIndex,
    flags: card.flags,
    scheduling: card.scheduling,
  }));
const sameAfter = (snapshot: Snapshot, entry: Entry) =>
  digest(snapshot.note.fields) === digest(entry.after) &&
  snapshot.note.noteType.id === entry.modelId &&
  digest(snapshot.note.cardIds) === digest(entry.before.note.cardIds) &&
  digest(snapshot.note.tags) === digest(entry.before.note.tags) &&
  digest(schedulingIdentity(snapshot)) ===
    digest(schedulingIdentity(entry.before));

export class NoteUpdateError extends Error {}

/** Existing-note operations share DeliveryService's queue; sessions never enter the persistent journal or UI. */
export class NoteUpdateService {
  private readonly loads = new Map<
    string,
    {
      deckId: string;
      profile: string;
      session: string;
      sourceId: string;
      snapshot: Snapshot;
      fields: Record<string, unknown>;
    }
  >();
  private readonly previews = new Map<
    string,
    {
      expires: number;
      entry: Entry;
      session: string;
      request: NoteUpdateRequest;
      files: { filename: string; key: string; checksum: string }[];
    }
  >();
  private readonly mediaTokens = new Map<string, { key: string }>();
  constructor(
    private readonly directory: string,
    private readonly delivery: DeliveryService,
    private readonly workspace: WorkspaceStore,
    private readonly audio: AudioService,
    private readonly anki: AnkiConnectClient,
  ) {}

  private prune() {
    for (const [key, value] of this.previews)
      if (value.expires < Date.now()) this.previews.delete(key);
    if (this.previews.size >= 100)
      throw new NoteUpdateError(
        'Too many pending note previews. Close old previews and try again later.',
      );
  }
  private token(key: string) {
    // These are opaque links to immutable, verified local artifacts, not write authorizations.
    // Retain them while editing and bound memory by evicting least recently used links.
    while (this.mediaTokens.size >= 1000)
      this.mediaTokens.delete(this.mediaTokens.keys().next().value!);
    const id = randomUUID();
    this.mediaTokens.set(id, { key });
    return `/api/notes/media/${id}`;
  }
  async media(id: string) {
    const value = this.mediaTokens.get(id);
    if (!value) return null;
    this.mediaTokens.delete(id);
    this.mediaTokens.set(id, value);
    return this.audio.media(value.key);
  }

  private receipt(ctx: OwnedNoteContext, noteId: string): DeliveryRecord {
    const entry = ctx.receipts.find((item) => item.noteId === noteId);
    if (
      !entry ||
      entry.profile !== ctx.collection.profile ||
      entry.deckId !== ctx.deckId ||
      entry.modelId !== ctx.modelId ||
      entry.state !== 'complete'
    )
      throw new NoteUpdateError(
        'This note has no verified delivery receipt for the selected collection and deck.',
      );
    return entry;
  }
  private async snapshot(
    ctx: OwnedNoteContext,
    receipt: DeliveryRecord,
  ): Promise<Snapshot> {
    await ctx.revalidate();
    const note = await ctx.findSource(receipt.id);
    if (
      !note ||
      note.id !== receipt.noteId ||
      note.noteType.id !== ctx.modelId ||
      note.fields.AvSourceId !== receipt.id ||
      note.cardIds.length !== 1 ||
      Object.keys(note.fields).length !== ankiFieldNames.length ||
      ankiFieldNames.some((field) => !Object.hasOwn(note.fields, field))
    )
      throw new NoteUpdateError(
        'Note identity or supported layout changed. No update was made.',
      );
    const cards = [];
    for (const id of note.cardIds) {
      const card = await this.anki.call(
        'cards.get',
        { id, session: ctx.collection.session },
        cardSchema,
      );
      if (
        card.noteId !== note.id ||
        card.deck.id !== ctx.deckId ||
        card.homeDeck
      )
        throw new NoteUpdateError(
          'The note is in a different or filtered deck. No update was made.',
        );
      cards.push(card);
    }
    return { note, cards };
  }
  private decoded(snapshot: Snapshot, receipt: DeliveryRecord, local: Card) {
    // The legacy snapshot is only a candidate: validate every rendered teaching field against the actual note.
    let fields: Record<string, unknown>;
    try {
      fields = coachFieldSchema.parse(
        JSON.parse(
          Buffer.from(snapshot.note.fields.AvContent!, 'base64').toString(
            'utf8',
          ),
        ),
      );
    } catch {
      throw new NoteUpdateError(
        'The legacy content snapshot cannot be validated against this note.',
      );
    }
    const encoded = ankiFields({ ...local, fields }, {});
    if (
      contentHash(fields) !== receipt.contentHash ||
      snapshot.note.fields.AvProfileVersion !== local.profileVersion ||
      sourceFields.some((key) => encoded[key] !== snapshot.note.fields[key])
    )
      throw new NoteUpdateError(
        'Anki content differs from the verified source snapshot. Resolve the external edit before loading.',
      );
    return fields;
  }

  private contentFields(
    card: Card,
    before: Snapshot,
    oldFields: Record<string, unknown>,
    filenames: Record<string, string>,
  ) {
    const after = ankiFields(card, filenames);
    const oldItems = extractAudioItems(oldFields);
    for (const item of extractAudioItems(card.fields)) {
      const field = audioFieldName(item.placementId);
      if (filenames[item.placementId] || !before.note.fields[field]) continue;
      const old = oldItems.find(
        (candidate) => candidate.placementId === item.placementId,
      );
      if (!old || old.text !== item.text)
        throw new NoteUpdateError(
          `Generate and select updated audio for ${item.placementId} before updating Anki. Its spoken text changed; existing audio will not be silently removed.`,
        );
      // Existing media was verified against its exact cached request and Anki bytes.
      // Deselecting a clip for generation is not an instruction to remove it.
      after[field] = before.note.fields[field]!;
    }
    return after;
  }

  private async updateMedia(card: Card, placementId?: string) {
    if (!placementId && !card.audioSelection?.placementIds.length) return [];
    return this.audio.deliveryAudio(
      card,
      placementId ? [placementId] : undefined,
    );
  }
  private async existingAudio(
    ctx: OwnedNoteContext,
    snapshot: Snapshot,
    sourceId: string,
  ) {
    const known = await this.audio.historyMedia(sourceId);
    const result: { placementId: string; url: string }[] = [];
    for (const placementId of [
      'target',
      'frontExample',
      'examples:0',
      'examples:1',
      'examples:2',
      'examples:3',
      'examples:4',
    ]) {
      const value = snapshot.note.fields[audioFieldName(placementId)];
      if (!value) continue;
      const match = /^\[sound:(av_[a-f0-9]{64}\.(?:mp3|wav))\]$/.exec(value);
      const artifact = match
        ? known.find((item) => ctx.filename(item.record) === match[1])
        : null;
      if (!artifact || !match)
        throw new NoteUpdateError(
          'Existing audio cannot be matched to a verified local artifact.',
        );
      const remote = await this.anki.call(
        'media.get',
        { filename: match[1], session: ctx.collection.session },
        z.strictObject({
          filename: z.string(),
          data: z.string().max(28000000),
        }),
      );
      if (
        remote.filename !== match[1] ||
        checksum(Buffer.from(remote.data, 'base64')) !==
          artifact.record.checksum
      )
        throw new NoteUpdateError(
          'Existing Anki media is missing or changed. No overwrite is allowed.',
        );
      result.push({ placementId, url: this.token(artifact.record.key) });
    }
    return result;
  }
  private async unresolved(sourceId: string, except?: string) {
    if (
      (await this.journal()).entries.some(
        (entry) =>
          entry.sourceId === sourceId &&
          entry.updateId !== except &&
          ['pending', 'writing', 'ambiguous', 'conflict'].includes(entry.state),
      )
    )
      throw new NoteUpdateError(
        'A previous update requires reconciliation. Use Reconcile before preparing another update.',
      );
  }
  async list(deckId: string) {
    return this.delivery.withOwnedNotes(deckId, async (ctx) => ({
      notes: ctx.receipts
        .filter(
          (entry) =>
            entry.profile === ctx.collection.profile &&
            entry.deckId === deckId &&
            entry.modelId === ctx.modelId &&
            entry.state === 'complete' &&
            entry.noteId,
        )
        .map((entry) => ({
          sourceId: entry.id,
          noteId: entry.noteId!,
          target: entry.target,
        })),
    }));
  }
  async load(deckId: string, noteId: string): Promise<NoteLoaded> {
    return this.delivery.withOwnedNotes(deckId, async (ctx) => {
      this.prune();
      const receipt = this.receipt(ctx, noteId);
      await this.unresolved(receipt.id);
      const snapshot = await this.snapshot(ctx, receipt);
      if (digest(snapshot.note.fields) !== digest(receipt.fields))
        throw new NoteUpdateError(
          'This Anki note was edited outside the app. Resolve the conflict before loading it.',
        );
      const local = (await this.workspace.read()).cards.find(
        (card) => card.id === receipt.id,
      );
      if (!local)
        throw new NoteUpdateError(
          'The linked local source is missing. Cross-workspace identity cannot be reused.',
        );
      const fields = this.decoded(snapshot, receipt, local);
      const audio = await this.existingAudio(ctx, snapshot, receipt.id);
      const loadId = randomUUID();
      // Editing is not an authorization to write. Every prepare/draft/send revalidates Anki.
      while (this.loads.size >= 100)
        this.loads.delete(this.loads.keys().next().value!);
      this.loads.set(loadId, {
        deckId,
        profile: ctx.collection.profile,
        session: ctx.collection.session,
        sourceId: receipt.id,
        snapshot,
        fields,
      });
      return {
        loadId,
        sourceId: receipt.id,
        noteId,
        deckId,
        deckName: ctx.deckName,
        profile: ctx.collection.profile,
        fields,
        audio,
      };
    });
  }
  async draft(loadId: string, expectedRevision: number) {
    const loaded = this.loaded(loadId);
    return this.delivery.withOwnedNotes(loaded.deckId, async (ctx) => {
      const receipt = this.receipt(ctx, loaded.snapshot.note.id);
      const current = await this.snapshot(ctx, receipt);
      if (
        ctx.collection.profile !== loaded.profile ||
        ctx.collection.session !== loaded.session ||
        digest(current) !== digest(loaded.snapshot)
      )
        throw new NoteUpdateError(
          'The loaded note changed. Load it again before using its fields.',
        );
      return this.workspace.update(loaded.sourceId, {
        expectedRevision,
        fields: loaded.fields,
        included: true,
      });
    });
  }
  private loaded(id: string) {
    const value = this.loads.get(id);
    if (!value)
      throw new NoteUpdateError(
        'The editing session is no longer available. Choose Reload Anki snapshot, then review again. Your saved text and audio are kept.',
      );
    this.loads.delete(id);
    this.loads.set(id, value);
    return value;
  }

  async prepare(input: NoteUpdateRequest): Promise<NoteUpdatePreview> {
    const loaded = this.loaded(input.loadId);
    if (loaded.sourceId !== input.card.id)
      throw new NoteUpdateError(
        'The saved source does not match the loaded note.',
      );
    return this.delivery.withOwnedNotes(loaded.deckId, async (ctx) =>
      this.workspace.withApprovedCard(
        input.card.id,
        input.card.revision,
        input.card.contentHash,
        async (card) => {
          this.prune();
          await this.unresolved(card.id);
          const receipt = this.receipt(ctx, loaded.snapshot.note.id);
          const before = await this.snapshot(ctx, receipt);
          if (
            loaded.profile !== ctx.collection.profile ||
            loaded.session !== ctx.collection.session ||
            digest(before) !== digest(loaded.snapshot) ||
            digest(before.note.fields) !== digest(receipt.fields)
          )
            throw new NoteUpdateError(
              'Anki changed after loading. Load and review the note again.',
            );
          if (
            input.mode === 'audio' &&
            (!input.placementId ||
              card.contentHash !== receipt.contentHash ||
              card.revision !== receipt.revision)
          )
            throw new NoteUpdateError(
              'Audio-only replacement requires the unchanged approved content revision and one placement.',
            );
          const media = await this.updateMedia(
            card,
            input.mode === 'audio' ? input.placementId! : undefined,
          );
          const filenames = Object.fromEntries(
            media.map((item) => [item.placementId, ctx.filename(item.record)]),
          );
          const oldAudio = await this.existingAudio(ctx, before, card.id);
          const oldFields = this.decoded(before, receipt, card);
          const after =
            input.mode === 'content'
              ? this.contentFields(card, before, oldFields, filenames)
              : {
                  ...before.note.fields,
                  [audioFieldName(input.placementId!)]:
                    `[sound:${filenames[input.placementId!]}]`,
                };
          const changes =
            input.mode === 'audio'
              ? []
              : coachFields
                  .filter(
                    (field) =>
                      digest(oldFields[field.key]) !==
                      digest(card.fields[field.key]),
                  )
                  .map((field) => ({
                    field: field.label,
                    before: Array.isArray(oldFields[field.key])
                      ? (oldFields[field.key] as string[]).join('\n')
                      : String(oldFields[field.key] ?? ''),
                    after: Array.isArray(card.fields[field.key])
                      ? (card.fields[field.key] as string[]).join('\n')
                      : String(card.fields[field.key] ?? ''),
                  }));
          const affected = extractAudioItems(card.fields).filter(
            (item) =>
              before.note.fields[audioFieldName(item.placementId)] !==
              after[audioFieldName(item.placementId)],
          );
          const audio = affected.map((item) => ({
            placementId: item.placementId,
            currentUrl:
              oldAudio.find((old) => old.placementId === item.placementId)
                ?.url ?? null,
            proposedUrl: media.find(
              (clip) => clip.placementId === item.placementId,
            )
              ? `/api/audio/${media.find((clip) => clip.placementId === item.placementId)!.key}`
              : null,
          }));
          // Include removed fifth-example audio too, even if the revised profile has fewer examples.
          for (const old of oldAudio)
            if (
              !extractAudioItems(card.fields).some(
                (item) => item.placementId === old.placementId,
              ) &&
              before.note.fields[audioFieldName(old.placementId)] !==
                after[audioFieldName(old.placementId)]
            )
              audio.push({
                placementId: old.placementId,
                currentUrl: old.url,
                proposedUrl: null,
              });
          const previewId = randomUUID();
          const nextReceipt: DeliveryRecord = {
            ...receipt,
            fields: after,
            payloadHash: createHash('sha256')
              .update(JSON.stringify(after))
              .digest('hex'),
            revision: card.revision,
            contentHash: card.contentHash,
            target: String(card.fields.target),
            audioCount: audioCount(after),
            state: 'complete',
            intent: 'unchanged',
            reason: 'Updated and verified in place in Anki.',
          };
          const entry: Entry = {
            updateId: previewId,
            sourceId: card.id,
            noteId: before.note.id,
            target: String(card.fields.target),
            state: 'pending',
            reason: 'Approved update prepared; no note write yet.',
            deckId: ctx.deckId,
            profile: ctx.collection.profile,
            modelId: ctx.modelId,
            before,
            after,
            receipt: nextReceipt,
          };
          const files = media
            .filter(
              (item) =>
                before.note.fields[audioFieldName(item.placementId)] !==
                after[audioFieldName(item.placementId)],
            )
            .map((item) => ({
              filename: ctx.filename(item.record),
              key: item.key,
              checksum: item.record.checksum,
            }));
          this.previews.set(previewId, {
            expires: Date.now() + 300000,
            entry,
            session: ctx.collection.session,
            request: input,
            files,
          });
          return {
            previewId,
            sourceId: card.id,
            noteId: before.note.id,
            revision: card.revision,
            deckName: ctx.deckName,
            profile: ctx.collection.profile,
            mode: input.mode,
            changes,
            audio,
            changedFields: ankiFieldNames.filter(
              (key) => before.note.fields[key] !== after[key],
            ).length,
          };
        },
      ),
    );
  }

  async send(previewId: string): Promise<NoteUpdateResult> {
    const preview = this.previews.get(previewId);
    if (!preview || preview.expires < Date.now())
      throw new NoteUpdateError(
        'Update preview expired. Prepare and review it again.',
      );
    return this.delivery.withOwnedNotes(preview.entry.deckId, async (ctx) => {
      const prior = (await this.journal()).entries.find(
        (entry) => entry.updateId === previewId,
      );
      if (prior) return publicResult(prior);
      return this.workspace.withApprovedCard(
        preview.request.card.id,
        preview.request.card.revision,
        preview.request.card.contentHash,
        async (card) => {
          const entry = entrySchema.parse(preview.entry);
          await this.unresolved(entry.sourceId);
          const receipt = this.receipt(ctx, entry.noteId);
          if (
            ctx.collection.profile !== entry.profile ||
            ctx.collection.session !== preview.session ||
            ctx.modelId !== entry.modelId ||
            digest(await this.snapshot(ctx, receipt)) !== digest(entry.before)
          )
            throw new NoteUpdateError(
              'Anki content, identity, or scheduling changed after preview. Load it again.',
            );
          const media = await this.updateMedia(
            card,
            preview.request.mode === 'audio'
              ? preview.request.placementId!
              : undefined,
          );
          const generated =
            preview.request.mode === 'content'
              ? this.contentFields(
                  card,
                  entry.before,
                  this.decoded(entry.before, receipt, card),
                  Object.fromEntries(
                    media.map((item) => [
                      item.placementId,
                      ctx.filename(item.record),
                    ]),
                  ),
                )
              : {
                  ...entry.before.note.fields,
                  [audioFieldName(preview.request.placementId!)]:
                    `[sound:${ctx.filename(media[0]!.record)}]`,
                };
          if (digest(generated) !== digest(entry.after))
            throw new NoteUpdateError(
              'Selected audio changed. Prepare and review a new update.',
            );
          if (digest(entry.before.note.fields) === digest(entry.after)) {
            entry.state = 'complete';
            entry.reason = 'No changes were required.';
            await this.saveEntry(entry);
            return publicResult(entry);
          }
          const description = await this.anki.call(
            'api.describe',
            {},
            descriptionSchema,
          );
          if (
            !description.methods.some(
              (method) => method.name === 'notes.update' && method.available,
            )
          )
            throw new NoteUpdateError(
              'This Anki API does not support in-place note updates.',
            );
          await this.saveEntry(entry);
          try {
            for (const file of preview.files) {
              await ctx.revalidate();
              const artifact = await this.audio.media(file.key);
              if (!artifact || artifact.record.checksum !== file.checksum)
                throw new NoteUpdateError('Replacement audio is unavailable.');
              await ctx.upload(file.filename, artifact.bytes, file.checksum);
            }
            if (
              digest(await this.snapshot(ctx, receipt)) !== digest(entry.before)
            )
              throw new NoteUpdateError(
                'Anki changed while uploading media. No note update was attempted.',
              );
          } catch {
            entry.state = 'not-applied';
            entry.reason =
              'Preparation/upload failed before the note write. Load and prepare again; existing notes and audio were kept.';
            await this.saveEntry(entry);
            return publicResult(entry);
          }
          entry.state = 'writing';
          entry.reason = 'Update requested; reconcile before retrying.';
          await this.saveEntry(entry);
          const fields = Object.fromEntries(
            Object.entries(entry.after).filter(
              ([key, value]) => entry.before.note.fields[key] !== value,
            ),
          );
          try {
            await this.anki.call(
              'notes.update',
              {
                id: entry.noteId,
                patch: { fields },
                session: ctx.collection.session,
              },
              noteSchema,
              true,
            );
            return await this.reconcileEntry(ctx, entry, false);
          } catch (error) {
            const rejectedEditor =
              error instanceof AnkiConnectError &&
              error.code === 'REMOTE' &&
              error.remoteType === 'editorConflict';
            entry.state = rejectedEditor ? 'not-applied' : 'ambiguous';
            entry.reason = rejectedEditor
              ? 'Anki rejected the update because an affected editor is open. Save and close that editor, then load and confirm a new preview.'
              : 'Update outcome is unresolved. Reconcile before any further update; no automatic retry is allowed.';
            await this.saveEntry(entry);
            return publicResult(entry);
          }
        },
      );
    });
  }

  async reconcile(updateId: string): Promise<NoteUpdateResult> {
    const entry = (await this.journal()).entries.find(
      (item) => item.updateId === updateId,
    );
    if (!entry) throw new NoteUpdateError('Saved update not found.');
    if (entry.state === 'complete' || entry.state === 'not-applied')
      return publicResult(entry);
    return this.delivery.withOwnedNotes(entry.deckId, async (ctx) => {
      const latest = (await this.journal()).entries.find(
        (item) => item.updateId === updateId,
      );
      if (!latest) throw new NoteUpdateError('Saved update not found.');
      return latest.state === 'complete' || latest.state === 'not-applied'
        ? publicResult(latest)
        : this.reconcileEntry(ctx, latest, true);
    });
  }
  private async reconcileEntry(
    ctx: OwnedNoteContext,
    entry: Entry,
    allowNotApplied: boolean,
  ): Promise<NoteUpdateResult> {
    if (
      ctx.collection.profile !== entry.profile ||
      ctx.modelId !== entry.modelId
    )
      throw new NoteUpdateError(
        'The saved update belongs to a different collection.',
      );
    const receipt = ctx.receipts.find((item) => item.id === entry.sourceId);
    if (!receipt || receipt.noteId !== entry.noteId)
      throw new NoteUpdateError('Saved update identity cannot be reconciled.');
    const actual = await this.snapshot(ctx, receipt);
    if (sameAfter(actual, entry)) {
      await this.existingAudio(ctx, actual, entry.sourceId);
      await ctx.saveReceipt(entry.receipt);
      entry.state = 'complete';
      entry.reason =
        'Updated note, card identity, audio, and scheduling verified in place.';
    } else if (allowNotApplied && digest(actual) === digest(entry.before)) {
      entry.state = 'not-applied';
      entry.reason =
        'The original note is unchanged. No retry was sent; load and explicitly confirm a new preview if needed.';
    } else {
      entry.state = 'conflict';
      entry.reason =
        'The note differs from both the confirmed update and its original snapshot. Resolve the conflict before further updates.';
    }
    await this.saveEntry(entry);
    return publicResult(entry);
  }
  async status() {
    return this.delivery.withDeliveryLock(async () => ({
      items: (await this.journal()).entries.map(publicResult),
    }));
  }
  private async journal() {
    try {
      return journalSchema.parse(
        JSON.parse(
          await readFile(join(this.directory, 'updates.json'), 'utf8'),
        ),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return { version: 1 as const, entries: [] as Entry[] };
      throw new NoteUpdateError('Saved updates could not be read.');
    }
  }
  private async saveEntry(entry: Entry) {
    const journal = await this.journal();
    const index = journal.entries.findIndex(
      (item) => item.updateId === entry.updateId,
    );
    if (index < 0) journal.entries.push(entrySchema.parse(entry));
    else journal.entries[index] = entrySchema.parse(entry);
    await mkdir(this.directory, { recursive: true });
    const temporary = join(this.directory, `${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, JSON.stringify(journalSchema.parse(journal)), {
        flag: 'wx',
      });
      await rename(temporary, join(this.directory, 'updates.json'));
    } finally {
      await rm(temporary, { force: true });
    }
  }
}
