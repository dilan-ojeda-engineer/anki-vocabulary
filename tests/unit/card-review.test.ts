import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkspaceStore } from '../../src/server/workspace';
import { previewImport } from '../../src/server/card-import';
import { cardSides, cardText } from '../../src/shared/card-display';
import { englishCoachFieldsFixture } from '../../src/shared/fixtures/workflow';

const fields = {
  ...englishCoachFieldsFixture,
  spanishPronunciation: 'Stress the first syllable and avoid a final vowel.',
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

describe('AV-030 saved card review', () => {
  it('migrates an AV-029 workspace and preserves original source and identity', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'anki-review-'));
    folders.push(directory);
    const old = {
      version: 1,
      cards: [
        {
          id: 'a603fa62-104f-46bd-bb84-6ff1df408500',
          profileVersion: 'av005-5',
          originalText: 'original text',
          fields,
          importedAt: '2026-11-02T00:00:00.000Z',
        },
      ],
    };
    await writeFile(join(directory, 'workspace.json'), JSON.stringify(old));
    const store = new WorkspaceStore(directory);
    const migrated = await store.read();
    expect(migrated.version).toBe(2);
    expect(migrated.cards[0]).toMatchObject({
      id: old.cards[0]!.id,
      originalFields: fields,
      included: true,
      revision: 1,
    });
    expect(
      JSON.parse(await readFile(join(directory, 'workspace.json'), 'utf8')),
    ).toEqual(old);
    const changed = await store.update(old.cards[0]!.id, {
      expectedRevision: 1,
      fields: { ...fields, meaning: 'A changed explanation.' },
      included: false,
    });
    expect(changed.cards[0]).toMatchObject({
      revision: 2,
      included: false,
      originalFields: fields,
      originalText: 'original text',
    });
    expect(
      (await new WorkspaceStore(directory).read()).cards[0]?.fields.meaning,
    ).toBe('A changed explanation.');
    await expect(
      store.update(old.cards[0]!.id, {
        expectedRevision: 1,
        fields,
        included: true,
      }),
    ).rejects.toThrow('Stale');
  });

  it('rejects invalid edits without changing another saved card', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'anki-review-'));
    folders.push(directory);
    const store = new WorkspaceStore(directory);
    const saved = await store.add(
      previewImport({
        format: 'json',
        text: JSON.stringify([fields, { ...fields, target: 'uneasy' }]),
      }),
      [1, 2],
    );
    const first = saved.cards[0]!;
    await expect(
      store.update(first.id, {
        expectedRevision: 1,
        fields: { ...fields, examples: [] },
        included: true,
      }),
    ).rejects.toThrow();
    const recovered = await store.read();
    expect(recovered.cards).toHaveLength(2);
    expect(recovered.cards[0]?.revision).toBe(1);
    expect(recovered.cards[1]?.fields.target).toBe('uneasy');
  });

  it('renders the official front/back order and omits inapplicable irregular forms', () => {
    const sides = cardSides(fields);
    expect(sides.front).toBe(
      'awkward\n“I felt awkward asking for help.”\nWhat does this expression mean?',
    );
    const headings = [
      'Meaning:',
      'Category:',
      'Pronunciation tip:',
      'Native English:',
      'For Spanish speakers:',
      'More examples:',
      'Common collocations/chunks:',
      'Common mistake and usage note:',
      'Natural alternatives:',
      'Spanish Translation:',
    ];
    let previous = -1;
    for (const heading of headings) {
      const position = sides.back.indexOf(heading);
      expect(position).toBeGreaterThan(previous);
      previous = position;
    }
    expect(sides.back).not.toContain('Irregular Forms:');
    expect(cardText(fields)).toBe(`${sides.front}\n${sides.back}`);
    expect(sides.back).toContain('- The timing felt awkward.');
  });
});
