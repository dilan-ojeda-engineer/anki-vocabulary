import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { previewImport } from '../../src/server/card-import';
import { WorkspaceStore } from '../../src/server/workspace';
import { englishCoachFieldsFixture } from '../../src/shared/fixtures/workflow';

const fields = {
  ...englishCoachFieldsFixture,
  spanishPronunciation:
    'Keep the first syllable stressed; avoid adding a final vowel.',
  examples: [...englishCoachFieldsFixture.examples, 'The timing felt awkward.'],
};
const folders: string[] = [];
afterEach(async () => {
  await Promise.all(
    folders
      .splice(0)
      .map((folder) => rm(folder, { recursive: true, force: true })),
  );
});

describe('AV-029 import and offline workspace', () => {
  it('keeps valid JSON cards while reporting invalid cards separately and survives a store restart', async () => {
    const input = {
      format: 'json' as const,
      text: JSON.stringify([fields, { ...fields, examples: [] }]),
    };
    const preview = previewImport(input);
    expect(preview.entries).toHaveLength(2);
    expect(preview.entries[0]?.issues).toEqual([]);
    expect(
      preview.entries[1]?.issues.some((issue) => issue.path === 'examples'),
    ).toBe(true);
    const directory = await mkdtemp(join(tmpdir(), 'anki-import-'));
    folders.push(directory);
    const store = new WorkspaceStore(directory);
    await expect(store.add(preview, [1, 2])).rejects.toThrow();
    expect((await store.read()).cards).toHaveLength(0);
    await store.add(preview, [1]);
    const recovered = await new WorkspaceStore(directory).read();
    expect(recovered.cards).toHaveLength(1);
    expect(recovered.cards[0]?.fields).toEqual(fields);
    expect(recovered.cards[0]?.originalText).toBe(input.text);
    expect(
      JSON.parse(await readFile(join(directory, 'workspace.json'), 'utf8')),
    ).toEqual(recovered);
  });

  it('validates official pasted headings and preserves the source', () => {
    const card = [
      fields.target,
      `“${fields.frontExample}”`,
      'What does this expression mean?',
      'Meaning:',
      fields.meaning,
      'Category:',
      fields.category,
      'Pronunciation tip:',
      'Native English:',
      fields.nativePronunciation,
      'For Spanish speakers:',
      fields.spanishPronunciation,
      'More examples:',
      ...fields.examples.map((item) => `- ${item}`),
      'Common collocations/chunks:',
      ...fields.chunks.map((item) => `- ${item}`),
      'Common mistake and usage note:',
      fields.usageNote,
      'Natural alternatives:',
      ...fields.alternatives.map((item) => `- ${item}`),
      'Spanish Translation:',
      fields.spanishTranslation,
    ].join('\n');
    const preview = previewImport({
      format: 'paste',
      text: `${card}\n---\n${card.replace('Spanish Translation:', 'Translation:')}`,
    });
    expect(preview.entries[0]?.fields).toEqual(fields);
    expect(preview.entries[0]?.originalText).toBe(`${card}\n`);
    expect(preview.entries[1]?.issues.length).toBeGreaterThan(0);
  });

  it('retains exact quoted CSV source rows and rejects malformed list cells', () => {
    const keys = Object.keys(fields);
    const encode = (value: unknown) =>
      `"${String(Array.isArray(value) ? JSON.stringify(value) : (value ?? '')).replaceAll('"', '""')}"`;
    const row = keys
      .map((key) => encode(fields[key as keyof typeof fields]))
      .join(',');
    const bad = row.replace('"[""There was', '"not-json');
    const preview = previewImport({
      format: 'csv',
      text: `${keys.join(',')}\n${row}\n${bad}`,
    });
    expect(preview.entries[0]?.issues).toEqual([]);
    expect(preview.entries[0]?.originalText).toBe(row);
    expect(preview.entries[1]?.issues.length).toBeGreaterThan(0);
  });

  it('isolates an unclosed quoted row and accepts multiline, non-ASCII TSV', () => {
    const keys = Object.keys(fields);
    const values = keys.map((key) => {
      const value = fields[key as keyof typeof fields];
      return `"${String(Array.isArray(value) ? JSON.stringify(value) : (value ?? '')).replaceAll('"', '""')}"`;
    });
    values[keys.indexOf('meaning')] =
      '"Feeling incómodo\nin a social situation."';
    const valid = values.join('\t');
    const preview = previewImport({
      format: 'tsv',
      text: `${keys.join('\t')}\n${valid}\n"unclosed`,
    });
    expect(preview.entries).toHaveLength(2);
    expect(preview.entries[0]?.issues).toEqual([]);
    expect(preview.entries[0]?.originalText).toBe(valid);
    expect(
      preview.entries[1]?.issues.some((issue) =>
        issue.message.includes('Unclosed'),
      ),
    ).toBe(true);
  });

  it('fails closed on a malformed persisted card without replacing the workspace', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'anki-import-'));
    folders.push(directory);
    const file = join(directory, 'workspace.json');
    const malformed = JSON.stringify({
      version: 1,
      cards: [
        {
          id: '19e90b2a-c9a0-42b7-9551-6b140edb4800',
          profileVersion: 'av005-5',
          originalText: 'bad',
          fields: { target: 'awkward' },
          importedAt: new Date().toISOString(),
        },
      ],
    });
    await writeFile(file, malformed);
    const store = new WorkspaceStore(directory);
    await expect(store.read()).rejects.toThrow();
    await expect(
      store.add(
        previewImport({ format: 'json', text: JSON.stringify([fields]) }),
        [1],
      ),
    ).rejects.toThrow();
    expect(await readFile(file, 'utf8')).toBe(malformed);
  });

  it('ignores an abandoned temporary write and keeps the last committed cards', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'anki-import-'));
    folders.push(directory);
    const store = new WorkspaceStore(directory);
    await store.add(
      previewImport({ format: 'json', text: JSON.stringify([fields]) }),
      [1],
    );
    await writeFile(
      join(directory, 'workspace-interrupted.tmp'),
      '{incomplete',
    );
    expect((await new WorkspaceStore(directory).read()).cards).toHaveLength(1);
  });
});
