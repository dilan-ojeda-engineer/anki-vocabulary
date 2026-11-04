import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import {
  AnkiConnectClient,
  AnkiConnectError,
  operationHandleSchema,
} from '../integrations/anki/client';
import {
  collectionSchema,
  deckSchema,
  descriptionSchema,
  entitySummarySchema,
  noteTypeSchema,
  noteSchema,
  searchPageSchema,
  noteCreatedSchema,
  cardSchema,
} from '../integrations/anki/schemas';
import type { WorkspaceStore } from './workspace';
import type { AudioService } from './audio-service';
import type { Workspace } from '../shared/card-import';
import type {
  DeliveryItem,
  DeliveryPreview,
  DeliveryRequest,
} from '../shared/delivery';
import { deliveryItemSchema } from '../shared/delivery';
import {
  ankiFields,
  ankiFieldNames,
  ankiTemplate,
  ankiCss,
} from './anki-template';

const sha = (value: string | Uint8Array) =>
  createHash('sha256').update(value).digest('hex');
const recordSchema = deliveryItemSchema.extend({
  contentHash: z.string(),
  profile: z.string(),
  deckId: z.string(),
  deckName: z.string(),
  modelId: z.string().nullable(),
  payloadHash: z.string(),
  fields: z.record(z.string(), z.string()),
});
const manifestSchema = z.strictObject({
  version: z.literal(1),
  namespace: z.uuid(),
  entries: z.array(recordSchema),
});
type Manifest = z.infer<typeof manifestSchema>;
type RecordEntry = z.infer<typeof recordSchema>;
const publicItem = (entry: RecordEntry): DeliveryItem =>
  deliveryItemSchema.strip().parse(entry);
type Collection = z.infer<typeof collectionSchema>;
export class DeliveryError extends Error {}
const reason = (error: unknown) => {
  if (error instanceof DeliveryError) return error.message;
  const message = error instanceof Error ? error.message : '';
  if (message === 'Stale card revision.')
    return 'Card revision changed; review and approve the current content before preparing again.';
  if (message === 'Card requires approval of its current revision.')
    return 'The included current card revision must be approved.';
  if (
    [
      'Select at least one audio placement before delivery.',
      'Selected audio is incomplete or stale.',
      'Selected audio is unavailable.',
    ].includes(message)
  )
    return message;
  return 'Anki or local storage is unavailable; prepare again to reconcile before retrying.';
};
const ownedModelSchema = noteTypeSchema.extend({
  css: z.string(),
  sortField: z.string(),
  templates: z.array(
    z.object({
      name: z.string(),
      questionHtml: z.string(),
      answerHtml: z.string(),
      deck: z.null().optional(),
    }),
  ),
});
const requiredMethods = [
  'collection.get',
  'decks.list',
  'noteTypes.list',
  'noteTypes.get',
  'noteTypes.create',
  'notes.search',
  'notes.get',
  'notes.create',
  'cards.get',
  'media.get',
  'media.store',
  'operations.get',
];

export class DeliveryService {
  private pending: Promise<unknown> = Promise.resolve();
  private readonly previews = new Map<
    string,
    {
      request: DeliveryRequest;
      collection: Collection;
      deckName: string;
      payloads: Record<string, string>;
      expires: number;
      consumed: boolean;
      items: DeliveryItem[];
      result?: DeliveryItem[];
    }
  >();
  constructor(
    private readonly directory: string,
    private readonly workspace: WorkspaceStore,
    private readonly audio: AudioService,
    private readonly anki: AnkiConnectClient,
  ) {}

  private serialized<T>(action: () => Promise<T>): Promise<T> {
    const operation = this.pending.then(action);
    this.pending = operation.catch(() => undefined);
    return operation;
  }

  async status() {
    return this.serialized(async () => ({
      items: (await this.manifest()).entries.map((entry) => publicItem(entry)),
    }));
  }

  async prepare(request: DeliveryRequest): Promise<DeliveryPreview> {
    return this.serialized(async () => {
      if (
        new Set(request.cards.map((card) => card.id)).size !==
        request.cards.length
      )
        throw new DeliveryError('Duplicate source card in delivery request.');
      const manifest = await this.manifest();
      const description = await this.anki.call(
        'api.describe',
        {},
        descriptionSchema,
      );
      const available = new Set(
        description.methods
          .filter((method) => method.available)
          .map((method) => method.name),
      );
      if (requiredMethods.some((method) => !available.has(method)))
        throw new DeliveryError('Required Anki capabilities are unavailable.');
      const collection = await this.anki.call(
        'collection.get',
        {},
        collectionSchema,
      );
      const deck = await this.destination(collection, request.deckId);
      const model = await this.model(manifest, collection, false);
      const items: DeliveryItem[] = [];
      const payloads: Record<string, string> = {};
      const savedCards = new Map(
        (await this.workspace.read()).cards.map((card) => [card.id, card]),
      );
      for (const ref of request.cards) {
        try {
          const item = await this.workspace.withApprovedCard(
            ref.id,
            ref.revision,
            ref.contentHash,
            async (card) => {
              const inspection = await this.inspect(
                manifest,
                card,
                collection,
                request.deckId,
                deck.name,
                model?.id ?? null,
              );
              payloads[card.id] = inspection.payloadHash;
              if (inspection.intent === 'create') {
                this.setEntry(manifest, inspection);
                await this.save(manifest);
              } else if (
                inspection.intent === 'unchanged' ||
                inspection.intent === 'reconcile'
              ) {
                this.setEntry(manifest, inspection);
                await this.save(manifest);
              }
              return publicItem(inspection);
            },
          );
          items.push(item);
        } catch (error) {
          const saved = savedCards.get(ref.id);
          items.push({
            id: ref.id,
            target: saved ? String(saved.fields.target) : 'Saved card',
            revision: ref.revision,
            state: 'blocked',
            intent: 'omit',
            reason:
              reason(error) +
              (error instanceof Error &&
              error.message === 'Selected audio is incomplete or stale.'
                ? ' Generate or retry the selected audio items, then prepare a new delivery preview.'
                : ''),
            noteId: null,
            audioCount: 0,
          });
        }
      }
      for (const [id, value] of this.previews)
        if (value.expires < Date.now()) this.previews.delete(id);
      if (this.previews.size >= 100)
        throw new DeliveryError('Too many delivery previews.');
      const previewId = randomUUID();
      // Store the confirmed references only. Blocked items never become writes on replay.
      const eligibleIds = new Set(
        items
          .filter(
            (item) =>
              item.intent === 'create' ||
              item.intent === 'unchanged' ||
              item.intent === 'reconcile',
          )
          .map((item) => item.id),
      );
      this.previews.set(previewId, {
        request: {
          ...request,
          cards: request.cards.filter((ref) => eligibleIds.has(ref.id)),
        },
        collection,
        deckName: deck.name,
        payloads,
        expires: Date.now() + 300_000,
        consumed: false,
        items,
      });
      return {
        previewId,
        profile: collection.profile,
        deckId: deck.id,
        deckName: deck.name,
        noteType: this.modelName(manifest),
        items,
      };
    });
  }

  async send(previewId: string) {
    return this.serialized(async () => {
      const preview = this.previews.get(previewId);
      if (!preview || preview.expires < Date.now())
        throw new DeliveryError('Delivery preview expired; prepare again.');
      if (preview.consumed) {
        const manifest = await this.manifest();
        return {
          items:
            preview.result ??
            preview.items.map((item) => {
              if (item.intent === 'omit') return item;
              const saved = manifest.entries.find(
                (entry) => entry.id === item.id,
              );
              return saved ? publicItem(saved) : item;
            }),
        };
      }
      await this.destination(
        preview.collection,
        preview.request.deckId,
        preview.deckName,
      );
      preview.consumed = true;
      const manifest = await this.manifest();
      const items: DeliveryItem[] = [];
      for (const [index, ref] of preview.request.cards.entries()) {
        try {
          const item = await this.workspace.withApprovedCard(
            ref.id,
            ref.revision,
            ref.contentHash,
            async (card) => {
              await this.destination(
                preview.collection,
                preview.request.deckId,
                preview.deckName,
              );
              let model = await this.model(manifest, preview.collection, false);
              let entry = await this.inspect(
                manifest,
                card,
                preview.collection,
                preview.request.deckId,
                preview.deckName,
                model?.id ?? null,
              );
              if (entry.payloadHash !== preview.payloads[card.id])
                throw new DeliveryError(
                  'Card audio or selection changed; prepare and confirm again.',
                );
              if (entry.intent !== 'create') {
                this.setEntry(manifest, entry);
                await this.save(manifest);
                return publicItem(entry);
              }
              model = await this.model(manifest, preview.collection, true);
              if (!model)
                throw new DeliveryError('Owned note type unavailable.');
              entry = { ...entry, modelId: model.id };
              this.setEntry(manifest, entry);
              await this.save(manifest);
              const media = await this.audio.deliveryAudio(card);
              for (const clip of media) {
                await this.destination(
                  preview.collection,
                  preview.request.deckId,
                  preview.deckName,
                );
                await this.storeMedia(
                  this.filename(manifest, clip.record),
                  clip.bytes,
                  clip.record.checksum,
                  preview.collection,
                );
              }
              // Reconcile again immediately before creating; no blind creation retry.
              const found = await this.findSource(card.id, preview.collection);
              if (found) {
                entry = await this.inspect(
                  manifest,
                  card,
                  preview.collection,
                  preview.request.deckId,
                  preview.deckName,
                  model.id,
                );
                this.setEntry(manifest, entry);
                await this.save(manifest);
                return publicItem(entry);
              }
              await this.destination(
                preview.collection,
                preview.request.deckId,
                preview.deckName,
              );
              await this.model(manifest, preview.collection, false);
              entry.state = 'creating';
              entry.reason = 'Creation requested; reconcile before any retry.';
              this.setEntry(manifest, entry);
              await this.save(manifest);
              try {
                const created = await this.anki.call(
                  'notes.create',
                  {
                    noteType: { id: model.id },
                    deck: { id: preview.request.deckId },
                    fields: entry.fields,
                    tags: ['anki-vocabulary', 'english-coach-v1'],
                    session: preview.collection.session,
                  },
                  noteCreatedSchema,
                  true,
                );
                entry.noteId = created.noteId;
                this.setEntry(manifest, entry);
                await this.save(manifest);
                const verified = await this.inspect(
                  manifest,
                  card,
                  preview.collection,
                  preview.request.deckId,
                  preview.deckName,
                  model.id,
                );
                if (
                  verified.state !== 'complete' ||
                  verified.noteId !== created.noteId
                )
                  throw new DeliveryError(
                    'Created note could not be verified.',
                  );
                entry = {
                  ...verified,
                  intent: 'create',
                  reason: 'Created and verified in Anki.',
                };
              } catch {
                entry.state = 'ambiguous';
                entry.intent = 'omit';
                entry.reason =
                  'Creation outcome is unresolved. Prepare again to reconcile; no automatic retry is allowed.';
              }
              this.setEntry(manifest, entry);
              await this.save(manifest);
              return publicItem(entry);
            },
          );
          items.push(item);
        } catch (error) {
          const prior = manifest.entries.find((entry) => entry.id === ref.id);
          if (prior && prior.state === 'pending') {
            prior.state = 'failed';
            prior.reason = reason(error);
            await this.save(manifest);
          }
          items.push({
            id: ref.id,
            target: prior?.target ?? 'Saved card',
            revision: ref.revision,
            state: 'failed',
            intent: 'omit',
            reason: reason(error),
            noteId: prior?.noteId ?? null,
            audioCount: prior?.audioCount ?? 0,
          });
          // A connection/session failure must not attempt later cards in another collection.
          if (
            error instanceof AnkiConnectError ||
            (error instanceof DeliveryError &&
              error.message.includes('session'))
          ) {
            for (const remaining of preview.request.cards.slice(index + 1)) {
              const saved = manifest.entries.find(
                (entry) => entry.id === remaining.id,
              );
              const skipped: DeliveryItem = {
                id: remaining.id,
                target: saved?.target ?? 'Saved card',
                revision: remaining.revision,
                state: saved?.state === 'complete' ? 'complete' : 'pending',
                intent: 'omit',
                reason:
                  'Not attempted because the delivery batch stopped after a connection or collection-session failure. Prepare again before sending.',
                noteId: saved?.noteId ?? null,
                audioCount: saved?.audioCount ?? 0,
              };
              items.push(skipped);
              if (saved && saved.state !== 'complete') {
                saved.reason = skipped.reason;
                saved.intent = 'omit';
              }
            }
            await this.save(manifest);
            break;
          }
        }
      }
      preview.result = preview.items.map(
        (original) => items.find((item) => item.id === original.id) ?? original,
      );
      return { items: preview.result };
    });
  }

  private async inspect(
    manifest: Manifest,
    card: Workspace['cards'][number],
    collection: Collection,
    deckId: string,
    deckName: string,
    modelId: string | null,
  ): Promise<RecordEntry> {
    const prior = manifest.entries.find((entry) => entry.id === card.id);
    if (
      prior &&
      (prior.profile !== collection.profile || prior.deckId !== deckId) &&
      (prior.noteId ||
        ['creating', 'ambiguous', 'complete'].includes(prior.state))
    )
      throw new DeliveryError(
        'Source identity is paired to another profile or destination; no cross-collection reuse is allowed.',
      );
    const clips = await this.audio.deliveryAudio(card);
    const fields = ankiFields(
      card,
      Object.fromEntries(
        clips.map((clip) => [
          clip.placementId,
          this.filename(manifest, clip.record),
        ]),
      ),
    );
    const payloadHash = sha(JSON.stringify(fields));
    const totalPlacements = 2 + (card.fields.examples as string[]).length;
    const base: RecordEntry = {
      id: card.id,
      target: String(card.fields.target),
      revision: card.revision,
      contentHash: card.contentHash,
      profile: collection.profile,
      deckId,
      deckName,
      modelId,
      payloadHash,
      fields,
      state: 'pending',
      intent: 'create',
      reason: `Create with ${clips.length} selected audio placements; ${totalPlacements - clips.length} unselected placements omitted.`,
      noteId: null,
      audioCount: clips.length,
    };
    const note = await this.findSource(card.id, collection);
    if (!note) {
      if (
        prior?.noteId ||
        prior?.state === 'complete' ||
        prior?.state === 'creating' ||
        prior?.state === 'ambiguous'
      )
        throw new DeliveryError(
          'Prior creation cannot be reconciled. Creation is blocked to prevent duplicates.',
        );
      return base;
    }
    if (
      !modelId ||
      note.noteType.id !== modelId ||
      note.fields.AvSourceId !== card.id ||
      note.cardIds.length !== 1 ||
      (prior?.noteId && prior.noteId !== note.id)
    )
      throw new DeliveryError(
        'Source identity or owned note type is incompatible.',
      );
    if (
      Object.keys(note.fields).length !== ankiFieldNames.length ||
      Object.entries(fields).some(([key, value]) => note.fields[key] !== value)
    )
      throw new DeliveryError(
        'An existing source note has different content or audio. Use the supported-note update workflow to update it in place.',
      );
    for (const id of note.cardIds) {
      const actual = await this.anki.call(
        'cards.get',
        { id, session: collection.session },
        cardSchema,
      );
      if (actual.noteId !== note.id || actual.deck.id !== deckId)
        throw new DeliveryError(
          'Existing note is in a different deck; no silent move is allowed.',
        );
    }
    for (const clip of clips) {
      try {
        const filename = this.filename(manifest, clip.record);
        const stored = await this.anki.call(
          'media.get',
          { filename, session: collection.session },
          z.object({ filename: z.string(), data: z.string().max(30_000_000) }),
        );
        if (
          stored.filename !== filename ||
          sha(Buffer.from(stored.data, 'base64')) !== clip.record.checksum
        )
          throw new Error('mismatch');
      } catch {
        throw new DeliveryError(
          'Existing note audio is missing or altered in Anki; delivery is blocked.',
        );
      }
    }
    return {
      ...base,
      state: 'complete',
      intent: prior?.state === 'complete' ? 'unchanged' : 'reconcile',
      reason:
        'Existing source note and destination verified; no new note required.',
      noteId: note.id,
    };
  }

  private filename(
    manifest: Manifest,
    record: { key: string; checksum: string; format: 'mp3' | 'wav' },
  ) {
    return `av_${sha(`${manifest.namespace}:${record.key}:${record.checksum}`)}.${record.format}`;
  }
  private modelName(manifest: Manifest) {
    return `AV_EnglishCoach_v1_${manifest.namespace.replaceAll('-', '')}`;
  }

  private async destination(
    expected: Collection,
    deckId: string,
    deckName?: string,
  ) {
    const actual = await this.anki.call('collection.get', {}, collectionSchema);
    if (
      actual.profile !== expected.profile ||
      actual.session !== expected.session
    )
      throw new DeliveryError(
        'Collection session changed; prepare and confirm a new preview.',
      );
    const decks = await this.anki.call(
      'decks.list',
      { session: expected.session },
      z.array(deckSchema),
    );
    const deck = decks.find(
      (deck) =>
        deck.id === deckId &&
        deck.kind === 'normal' &&
        (!deckName || deck.name === deckName),
    );
    if (!deck)
      throw new DeliveryError(
        'Selected existing normal deck is unavailable or changed.',
      );
    return deck;
  }

  private async model(
    manifest: Manifest,
    collection: Collection,
    create: boolean,
  ) {
    const name = this.modelName(manifest);
    const models = await this.anki.call(
      'noteTypes.list',
      { session: collection.session },
      z.array(entitySummarySchema),
    );
    const found = models.filter((model) => model.name === name);
    if (found.length > 1)
      throw new DeliveryError('Owned note type identity is ambiguous.');
    let model;
    if (found[0])
      model = await this.anki.call(
        'noteTypes.get',
        { noteType: { id: found[0].id }, session: collection.session },
        ownedModelSchema,
      );
    else {
      if (
        manifest.entries.some(
          (entry) =>
            entry.profile === collection.profile &&
            (entry.noteId ||
              entry.state === 'creating' ||
              entry.state === 'ambiguous'),
        )
      )
        throw new DeliveryError(
          'Previously used owned note type is missing; collection identity is unresolved.',
        );
      if (!create) return null;
      const actual = await this.anki.call(
        'collection.get',
        {},
        collectionSchema,
      );
      if (
        actual.session !== collection.session ||
        actual.profile !== collection.profile
      )
        throw new DeliveryError('Collection session changed.');
      model = await this.anki.call(
        'noteTypes.create',
        {
          name,
          kind: 'normal',
          fields: ankiFieldNames.map((name) => ({ name })),
          templates: [ankiTemplate],
          sortField: 'Target',
          css: ankiCss,
          session: collection.session,
        },
        ownedModelSchema,
        true,
      );
    }
    if (
      model.name !== name ||
      model.kind !== 'normal' ||
      model.fields.map((field) => field.name).join('|') !==
        ankiFieldNames.join('|') ||
      model.templates.length !== 1 ||
      model.templates[0]?.name !== ankiTemplate.name ||
      model.templates[0]?.questionHtml !== ankiTemplate.questionHtml ||
      model.templates[0]?.answerHtml !== ankiTemplate.answerHtml ||
      model.css !== ankiCss ||
      model.sortField !== 'Target'
    )
      throw new DeliveryError(
        'Owned note type layout has changed; delivery is blocked.',
      );
    const ids = manifest.entries
      .filter((entry) => entry.profile === collection.profile && entry.modelId)
      .map((entry) => entry.modelId);
    if (ids.some((id) => id !== model.id))
      throw new DeliveryError(
        'Owned note type ID does not match saved delivery identity.',
      );
    return model;
  }

  private async findSource(id: string, collection: Collection) {
    const page = await this.anki.call(
      'notes.search',
      { query: `AvSourceId:${id}`, limit: 2, session: collection.session },
      searchPageSchema,
    );
    if (page.nextCursor !== null || page.ids.length > 1)
      throw new DeliveryError(
        'Multiple notes have this source identity; delivery is blocked.',
      );
    if (!page.ids[0]) return null;
    const note = await this.anki.call(
      'notes.get',
      { id: page.ids[0], session: collection.session },
      noteSchema,
    );
    if (note.id !== page.ids[0])
      throw new DeliveryError('Anki note identity mismatch.');
    return note;
  }

  private async storeMedia(
    filename: string,
    bytes: Uint8Array,
    checksum: string,
    collection: Collection,
  ) {
    const mediaSchema = z.strictObject({
      filename: z.string(),
      data: z.string().max(30_000_000),
    });
    try {
      const existing = await this.anki.call(
        'media.get',
        { filename, session: collection.session },
        mediaSchema,
      );
      if (
        existing.filename !== filename ||
        sha(Buffer.from(existing.data, 'base64')) !== checksum
      )
        throw new DeliveryError(
          'Existing media differs; no overwrite is allowed.',
        );
      return;
    } catch (error) {
      if (!(
        error instanceof AnkiConnectError && error.remoteType === 'notFound'
      ))
        throw error;
    }
    const handle = await this.anki.call(
      'media.store',
      {
        filename,
        source: { data: Buffer.from(bytes).toString('base64') },
        collision: 'error',
        session: collection.session,
      },
      operationHandleSchema,
      true,
    );
    const stored = await this.anki.wait(
      handle,
      collection.session,
      z.strictObject({
        filename: z.string(),
        status: z.literal('stored'),
        sha256: z.string(),
      }),
    );
    if (stored.filename !== filename || stored.sha256 !== checksum)
      throw new DeliveryError('Uploaded media could not be verified.');
    const readback = await this.anki.call(
      'media.get',
      { filename, session: collection.session },
      mediaSchema,
    );
    if (
      readback.filename !== filename ||
      sha(Buffer.from(readback.data, 'base64')) !== checksum
    )
      throw new DeliveryError('Uploaded media checksum differs.');
  }

  private setEntry(manifest: Manifest, entry: RecordEntry) {
    const index = manifest.entries.findIndex((value) => value.id === entry.id);
    if (index < 0) manifest.entries.push(entry);
    else manifest.entries[index] = entry;
  }
  private async manifest(): Promise<Manifest> {
    try {
      const data = manifestSchema.parse(
        JSON.parse(
          await readFile(join(this.directory, 'delivery.json'), 'utf8'),
        ),
      );
      if (
        new Set(data.entries.map((entry) => entry.id)).size !==
        data.entries.length
      )
        throw new DeliveryError('Duplicate saved delivery identity.');
      return data;
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        const data: Manifest = {
          version: 1,
          namespace: randomUUID(),
          entries: [],
        };
        await this.save(data);
        return data;
      }
      throw error;
    }
  }
  private async save(manifest: Manifest) {
    await mkdir(this.directory, { recursive: true });
    const path = join(this.directory, `${randomUUID()}.tmp`);
    try {
      await writeFile(path, JSON.stringify(manifestSchema.parse(manifest)), {
        flag: 'wx',
      });
      await rename(path, join(this.directory, 'delivery.json'));
    } finally {
      await rm(path, { force: true });
    }
  }
}
