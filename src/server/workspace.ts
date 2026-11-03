import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { savedCardSchema, workspaceSchema } from '../shared/card-import';
import type { ImportPreview, Workspace } from '../shared/card-import';
import { audioPlanSchema, extractAudioItems } from '../shared/audio-plan';
import type { AudioPlan, AudioSelectionRequest } from '../shared/audio-plan';
import { createEnglishCoachProfile } from '../profiles/english-coach';
import { createFieldValuesSchema } from '../shared/contracts';
import { z } from 'zod';
import type {
  UpdateCardRequest,
  ApproveCardRequest,
} from '../shared/card-import';

const fieldsSchema = createFieldValuesSchema(
  createEnglishCoachProfile('Workspace validation only'),
);
const workspaceV1Schema = z.strictObject({
  version: z.literal(1),
  cards: z.array(
    z.strictObject({
      id: z.uuid(),
      profileVersion: z.literal('av005-5'),
      originalText: z.string(),
      fields: z.record(z.string(), z.unknown()),
      importedAt: z.iso.datetime(),
    }),
  ),
});
const workspaceV2Schema = z.strictObject({
  version: z.literal(2),
  cards: z.array(
    z.strictObject({
      id: z.uuid(),
      profileVersion: z.literal('av005-5'),
      originalText: z.string(),
      originalFields: z.record(z.string(), z.unknown()),
      fields: z.record(z.string(), z.unknown()),
      included: z.boolean(),
      revision: z.number().int().positive(),
      importedAt: z.iso.datetime(),
    }),
  ),
});
const workspaceV3Schema = z.strictObject({
  version: z.literal(3),
  cards: z.array(savedCardSchema.omit({ audioSelection: true })),
});

export function contentHash(fields: unknown): string {
  const validated = fieldsSchema.parse(fields);
  return createHash('sha256')
    .update(JSON.stringify({ profileVersion: 'av005-5', fields: validated }))
    .digest('hex');
}

export function requireApprovedCard(card: Workspace['cards'][number]): void {
  if (
    !card.included ||
    !card.approval ||
    card.approval.revision !== card.revision ||
    card.approval.contentHash !== card.contentHash ||
    card.contentHash !== contentHash(card.fields)
  )
    throw new Error('Card requires approval of its current revision.');
}

function audioPlanFor(card: Workspace['cards'][number]): AudioPlan {
  requireApprovedCard(card);
  return audioPlanSchema.parse({
    cardId: card.id,
    revision: card.revision,
    contentHash: card.contentHash,
    items: extractAudioItems(card.fields),
  });
}

export class WorkspaceStore {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private readonly directory: string) {}

  async withApprovedCard<T>(
    id: string,
    expectedRevision: number,
    expectedContentHash: string,
    action: (card: Workspace['cards'][number]) => Promise<T> | T,
  ): Promise<T> {
    const operation = this.pending.then(async () => {
      const workspace = await this.read();
      const card = workspace.cards.find((item) => item.id === id);
      if (!card) throw new Error('Card not found.');
      if (
        card.revision !== expectedRevision ||
        card.contentHash !== expectedContentHash
      )
        throw new Error('Stale card revision.');
      requireApprovedCard(card);
      return action(card);
    });
    this.pending = operation.catch(() => undefined);
    return operation;
  }

  async audioPlan(
    id: string,
    expectedRevision: number,
    expectedContentHash: string,
  ): Promise<AudioPlan> {
    return this.withApprovedCard(
      id,
      expectedRevision,
      expectedContentHash,
      audioPlanFor,
    );
  }

  async selectAudio(
    id: string,
    input: AudioSelectionRequest,
  ): Promise<Workspace> {
    const operation = this.pending.then(async () => {
      const current = await this.read();
      const index = current.cards.findIndex((card) => card.id === id);
      if (index < 0) throw new Error('Card not found.');
      const card = current.cards[index]!;
      if (
        card.revision !== input.expectedRevision ||
        card.contentHash !== input.expectedContentHash
      )
        throw new Error('Stale card revision.');
      const allowed = new Set(
        audioPlanFor(card)
          .items.filter((item) => item.status !== 'invalid')
          .map((item) => item.placementId),
      );
      const requested = new Set(input.placementIds);
      if (
        requested.size !== input.placementIds.length ||
        input.placementIds.some((placementId) => !allowed.has(placementId))
      )
        throw new Error('Invalid audio placement selection.');
      const ordered = [...allowed].filter((placementId) =>
        requested.has(placementId),
      );
      if (
        card.audioSelection &&
        JSON.stringify(card.audioSelection.placementIds) ===
          JSON.stringify(ordered)
      )
        return current;
      const cards = [...current.cards];
      cards[index] = {
        ...card,
        audioSelection: {
          revision: card.revision,
          contentHash: card.contentHash,
          placementIds: ordered,
        },
      };
      const next = workspaceSchema.parse({ version: 4, cards });
      await this.write(next);
      return next;
    });
    this.pending = operation.catch(() => undefined);
    return operation;
  }

  async read(): Promise<Workspace> {
    try {
      const raw: unknown = JSON.parse(
        await readFile(join(this.directory, 'workspace.json'), 'utf8'),
      );
      const old = workspaceV1Schema.safeParse(raw);
      const older = workspaceV2Schema.safeParse(raw);
      const previous = workspaceV3Schema.safeParse(raw);
      const migrated = old.success
        ? old.data.cards.map((card) => ({
            ...card,
            originalFields: card.fields,
            included: true,
            revision: 1,
          }))
        : older.success
          ? older.data.cards
          : null;
      const workspace = migrated
        ? workspaceSchema.parse({
            version: 4,
            cards: migrated.map((card) => ({
              ...card,
              contentHash: contentHash(card.fields),
              approval: null,
              audioSelection: null,
            })),
          })
        : previous.success
          ? workspaceSchema.parse({
              version: 4,
              cards: previous.data.cards.map((card) => ({
                ...card,
                audioSelection: null,
              })),
            })
          : workspaceSchema.parse(raw);
      const ids = new Set<string>();
      for (const card of workspace.cards) {
        fieldsSchema.parse(card.fields);
        fieldsSchema.parse(card.originalFields);
        if (card.contentHash !== contentHash(card.fields))
          throw new Error('Saved card content hash does not match.');
        if (
          card.approval &&
          (card.approval.revision !== card.revision ||
            card.approval.contentHash !== card.contentHash ||
            !card.included)
        )
          throw new Error(
            'Saved card approval does not match current revision.',
          );
        if (card.audioSelection) {
          if (
            !card.approval ||
            card.audioSelection.revision !== card.revision ||
            card.audioSelection.contentHash !== card.contentHash
          )
            throw new Error('Saved audio selection is stale.');
          const allowed = new Set(
            extractAudioItems(card.fields)
              .filter((item) => item.status !== 'invalid')
              .map((item) => item.placementId),
          );
          const selected = card.audioSelection.placementIds;
          if (
            new Set(selected).size !== selected.length ||
            selected.some((placementId) => !allowed.has(placementId))
          )
            throw new Error('Saved audio selection is invalid.');
        }
        if (ids.has(card.id)) throw new Error('Duplicate saved card identity.');
        ids.add(card.id);
      }
      return workspace;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      )
        return { version: 4, cards: [] };
      throw error;
    }
  }

  async add(preview: ImportPreview, selected: number[]): Promise<Workspace> {
    const operation = this.pending.then(async () => {
      const current = await this.read();
      const chosen = new Set(selected);
      if (
        chosen.size !== selected.length ||
        selected.some((index) => !Number.isInteger(index) || index < 1)
      )
        throw new Error('Invalid selection.');
      const now = new Date().toISOString();
      const added = preview.entries.filter((entry) => chosen.has(entry.index));
      if (
        added.length !== selected.length ||
        added.some((entry) => entry.issues.length || !entry.fields)
      )
        throw new Error('Only valid preview entries may be saved.');
      const next = workspaceSchema.parse({
        version: 4,
        cards: [
          ...current.cards,
          ...added.map((entry) => ({
            id: randomUUID(),
            profileVersion: 'av005-5',
            originalText: entry.originalText,
            originalFields: entry.fields,
            fields: entry.fields,
            included: true,
            revision: 1,
            contentHash: contentHash(entry.fields),
            approval: null,
            audioSelection: null,
            importedAt: now,
          })),
        ],
      });
      await this.write(next);
      return next;
    });
    this.pending = operation.catch(() => undefined);
    return operation;
  }

  async update(id: string, input: UpdateCardRequest): Promise<Workspace> {
    const operation = this.pending.then(async () => {
      const current = await this.read();
      const index = current.cards.findIndex((card) => card.id === id);
      if (index < 0) throw new Error('Card not found.');
      const card = current.cards[index]!;
      if (card.revision !== input.expectedRevision)
        throw new Error('Stale card revision.');
      const fields = fieldsSchema.parse(input.fields);
      const changed =
        JSON.stringify(fields) !== JSON.stringify(card.fields) ||
        input.included !== card.included;
      if (!changed) return current;
      const cards = [...current.cards];
      cards[index] = {
        ...card,
        fields,
        included: input.included,
        revision: card.revision + 1,
        contentHash: contentHash(fields),
        approval: null,
        audioSelection: null,
      };
      const next = workspaceSchema.parse({ version: 4, cards });
      await this.write(next);
      return next;
    });
    this.pending = operation.catch(() => undefined);
    return operation;
  }

  async approve(id: string, input: ApproveCardRequest): Promise<Workspace> {
    const operation = this.pending.then(async () => {
      const current = await this.read();
      const index = current.cards.findIndex((card) => card.id === id);
      if (index < 0) throw new Error('Card not found.');
      const card = current.cards[index]!;
      if (
        card.revision !== input.expectedRevision ||
        card.contentHash !== input.expectedContentHash
      )
        throw new Error('Stale card revision.');
      if (!card.included) throw new Error('Excluded card cannot be approved.');
      if (card.approval) return current;
      const cards = [...current.cards];
      cards[index] = {
        ...card,
        approval: {
          revision: card.revision,
          contentHash: card.contentHash,
          approvedAt: new Date().toISOString(),
        },
      };
      const next = workspaceSchema.parse({ version: 4, cards });
      await this.write(next);
      return next;
    });
    this.pending = operation.catch(() => undefined);
    return operation;
  }

  private async write(next: Workspace): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const temporary = join(this.directory, `workspace-${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, JSON.stringify(next), {
        encoding: 'utf8',
        flag: 'wx',
      });
      await rename(temporary, join(this.directory, 'workspace.json'));
    } finally {
      await rm(temporary, { force: true });
    }
  }
}
