import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { workspaceSchema } from '../shared/card-import';
import type { ImportPreview, Workspace } from '../shared/card-import';
import { createEnglishCoachProfile } from '../profiles/english-coach';
import { createFieldValuesSchema } from '../shared/contracts';

const fieldsSchema = createFieldValuesSchema(
  createEnglishCoachProfile('Workspace validation only'),
);

export class WorkspaceStore {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private readonly directory: string) {}

  async read(): Promise<Workspace> {
    try {
      const workspace = workspaceSchema.parse(
        JSON.parse(
          await readFile(join(this.directory, 'workspace.json'), 'utf8'),
        ),
      );
      const ids = new Set<string>();
      for (const card of workspace.cards) {
        fieldsSchema.parse(card.fields);
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
        return { version: 1, cards: [] };
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
        version: 1,
        cards: [
          ...current.cards,
          ...added.map((entry) => ({
            id: randomUUID(),
            profileVersion: 'av005-5',
            originalText: entry.originalText,
            fields: entry.fields,
            importedAt: now,
          })),
        ],
      });
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
      return next;
    });
    this.pending = operation.catch(() => undefined);
    return operation;
  }
}
