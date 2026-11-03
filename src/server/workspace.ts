import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { workspaceSchema } from '../shared/card-import';
import type { ImportPreview, Workspace } from '../shared/card-import';
import { createEnglishCoachProfile } from '../profiles/english-coach';
import { createFieldValuesSchema } from '../shared/contracts';
import { z } from 'zod';
import type { UpdateCardRequest } from '../shared/card-import';

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

export class WorkspaceStore {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private readonly directory: string) {}

  async read(): Promise<Workspace> {
    try {
      const raw: unknown = JSON.parse(
        await readFile(join(this.directory, 'workspace.json'), 'utf8'),
      );
      const old = workspaceV1Schema.safeParse(raw);
      const workspace = old.success
        ? workspaceSchema.parse({
            version: 2,
            cards: old.data.cards.map((card) => ({
              ...card,
              originalFields: card.fields,
              included: true,
              revision: 1,
            })),
          })
        : workspaceSchema.parse(raw);
      const ids = new Set<string>();
      for (const card of workspace.cards) {
        fieldsSchema.parse(card.fields);
        fieldsSchema.parse(card.originalFields);
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
        return { version: 2, cards: [] };
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
        version: 2,
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
      };
      const next = workspaceSchema.parse({ version: 2, cards });
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
