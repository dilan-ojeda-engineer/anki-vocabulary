import { expect, it } from 'vitest';
import { audioReviewSchema } from '../../src/shared/audio-generation';
import { extractAudioItems } from '../../src/shared/audio-plan';
import { planNoteAudio } from '../../src/shared/note-audio-plan';
import { englishCoachFieldsFixture as baseFields } from '../../src/shared/fixtures/workflow';
import type { NoteLoaded } from '../../src/shared/note-update';

const englishCoachFieldsFixture = {
  ...baseFields,
  examples: [
    ...baseFields.examples,
    'It was an awkward question.',
    'The timing felt awkward.',
  ],
};
const loaded: NoteLoaded = {
  loadId: '00000000-0000-4000-8000-000000000001',
  sourceId: '00000000-0000-4000-8000-000000000002',
  noteId: '1',
  deckId: '2',
  deckName: 'Fixture',
  profile: 'Fixture',
  fields: englishCoachFieldsFixture,
  audio: extractAudioItems(englishCoachFieldsFixture).map((item) => ({
    placementId: item.placementId,
    url: '/fixture.wav',
  })),
};
function review(
  fields: unknown = englishCoachFieldsFixture,
  readyIds: string[] = [],
) {
  return audioReviewSchema.parse({
    cardId: loaded.sourceId,
    revision: 2,
    contentHash: 'a'.repeat(64),
    configuration: null,
    voiceName: 'Fixture',
    items: extractAudioItems(fields).map((item) => ({
      ...item,
      audioState: readyIds.includes(item.placementId) ? 'complete' : 'stale',
      artifactKey: readyIds.includes(item.placementId) ? 'b'.repeat(64) : null,
      previousKey: null,
      previousText: null,
      error: null,
      retryMode: 'explicit',
    })),
  });
}
it('keeps unchanged clips across a content revision without demanding regeneration', () => {
  const rows = planNoteAudio(
    loaded,
    review({ ...englishCoachFieldsFixture, meaning: 'A clearer explanation.' }),
  );
  expect(
    rows.every((row) => row.hasExisting && row.unchanged && !row.needsAudio),
  ).toBe(true);
});
it('requires only changed speech without a ready clip, ignoring stale selections', () => {
  const fields = {
    ...englishCoachFieldsFixture,
    target: 'awkward moment',
    frontExample: 'It was an awkward moment.',
    examples: [
      'A newly changed example.',
      ...englishCoachFieldsFixture.examples.slice(1),
    ],
  };
  const rows = planNoteAudio(loaded, review(fields, ['examples:0']));
  expect(
    rows.filter((row) => row.needsAudio).map((row) => row.placementId),
  ).toEqual(['target', 'frontExample']);
  expect(rows.filter((row) => row.ready).map((row) => row.placementId)).toEqual(
    ['examples:0'],
  );
});
it('compares normalized speech rather than display markup', () => {
  const rows = planNoteAudio(
    loaded,
    review({
      ...englishCoachFieldsFixture,
      target: `**${englishCoachFieldsFixture.target}**`,
    }),
  );
  expect(rows.find((row) => row.placementId === 'target')).toMatchObject({
    unchanged: true,
    needsAudio: false,
  });
});
it('keeps placements without existing audio optional until the owner generates them', () => {
  const withoutAudio = { ...loaded, audio: [] };
  expect(
    planNoteAudio(withoutAudio, review()).every(
      (row) => !row.required && !row.hasExisting,
    ),
  ).toBe(true);
  expect(
    planNoteAudio(withoutAudio, review(undefined, ['target'])).find(
      (row) => row.placementId === 'target',
    )?.ready,
  ).toBe(true);
});
it('does not count deleted examples as generation work', () => {
  const rows = planNoteAudio(
    loaded,
    review({
      ...englishCoachFieldsFixture,
      examples: englishCoachFieldsFixture.examples.slice(0, 4),
    }),
  );
  expect(rows.some((row) => row.placementId === 'examples:4')).toBe(false);
  expect(rows.filter((row) => row.needsAudio)).toEqual([]);
});
it('does not treat a failed clip as ready even if an artifact ID is present', () => {
  const result = review(
    { ...englishCoachFieldsFixture, target: 'awkward moment' },
    ['target'],
  );
  result.items[0]!.audioState = 'failed';
  expect(planNoteAudio(loaded, result)[0]).toMatchObject({
    ready: false,
    needsAudio: true,
    label: 'Target',
  });
});
