import { generationProfileSchema } from '../contracts';

// Synthetic scaffolding data, not a production prompt or linguistic sign-off.
export const englishCoachProfileFixture = generationProfileSchema.parse({
  ref: { id: 'english-coach', version: 'fixture-1' },
  name: 'English Coach (fixture)',
  prompt: {
    version: 'fixture-1',
    text: 'Synthetic English Coach fixture; not a production generation prompt.',
    source: {
      kind: 'fixture',
      reference: 'docs/CARD_SPEC.md#original-user-prompt',
    },
  },
  fields: [
    {
      kind: 'text',
      key: 'target',
      label: 'Target',
      required: true,
      nullable: false,
    },
    {
      kind: 'text',
      key: 'frontExample',
      label: 'Example',
      required: true,
      nullable: false,
    },
    {
      kind: 'text',
      key: 'meaning',
      label: 'Meaning:',
      required: true,
      nullable: false,
    },
    {
      kind: 'text',
      key: 'category',
      label: 'Category:',
      required: true,
      nullable: false,
    },
    {
      kind: 'text',
      key: 'irregularForms',
      label: 'Irregular Forms:',
      required: true,
      nullable: true,
    },
    {
      kind: 'text',
      key: 'nativePronunciation',
      label: 'Native English:',
      required: true,
      nullable: false,
    },
    {
      kind: 'text',
      key: 'spanishPronunciation',
      label: 'For Spanish speakers:',
      required: true,
      nullable: false,
    },
    {
      kind: 'text-list',
      key: 'examples',
      label: 'More examples:',
      required: true,
      minItems: 3,
      maxItems: 4,
    },
    {
      kind: 'text-list',
      key: 'chunks',
      label: 'Common collocations/chunks:',
      required: true,
      minItems: 3,
      maxItems: 6,
    },
    {
      kind: 'text',
      key: 'usageNote',
      label: 'Common mistake and usage note:',
      required: true,
      nullable: false,
    },
    {
      kind: 'text-list',
      key: 'alternatives',
      label: 'Natural alternatives:',
      required: true,
      minItems: 2,
      maxItems: 4,
    },
    {
      kind: 'text',
      key: 'spanishTranslation',
      label: 'Spanish Translation:',
      required: true,
      nullable: false,
    },
  ],
  layout: {
    front: [
      {
        kind: 'field',
        fieldKey: 'target',
        heading: null,
        format: 'plain',
        omitWhenNull: false,
      },
      {
        kind: 'field',
        fieldKey: 'frontExample',
        heading: null,
        format: 'quoted',
        omitWhenNull: false,
      },
      { kind: 'text', text: 'What does this expression mean?' },
    ],
    back: [
      {
        kind: 'field',
        fieldKey: 'meaning',
        heading: 'Meaning:',
        format: 'plain',
        omitWhenNull: false,
      },
      {
        kind: 'field',
        fieldKey: 'category',
        heading: 'Category:',
        format: 'plain',
        omitWhenNull: false,
      },
      {
        kind: 'field',
        fieldKey: 'irregularForms',
        heading: 'Irregular Forms:',
        format: 'plain',
        omitWhenNull: true,
      },
      {
        kind: 'group',
        heading: 'Pronunciation tip:',
        fields: [
          {
            kind: 'field',
            fieldKey: 'nativePronunciation',
            heading: 'Native English:',
            format: 'plain',
            omitWhenNull: false,
          },
          {
            kind: 'field',
            fieldKey: 'spanishPronunciation',
            heading: 'For Spanish speakers:',
            format: 'plain',
            omitWhenNull: false,
          },
        ],
      },
      {
        kind: 'field',
        fieldKey: 'examples',
        heading: 'More examples:',
        format: 'plain',
        omitWhenNull: false,
      },
      {
        kind: 'field',
        fieldKey: 'chunks',
        heading: 'Common collocations/chunks:',
        format: 'plain',
        omitWhenNull: false,
      },
      {
        kind: 'field',
        fieldKey: 'usageNote',
        heading: 'Common mistake and usage note:',
        format: 'plain',
        omitWhenNull: false,
      },
      {
        kind: 'field',
        fieldKey: 'alternatives',
        heading: 'Natural alternatives:',
        format: 'plain',
        omitWhenNull: false,
      },
      {
        kind: 'field',
        fieldKey: 'spanishTranslation',
        heading: 'Spanish Translation:',
        format: 'plain',
        omitWhenNull: false,
      },
    ],
  },
  audioSelectors: [
    { fieldKey: 'frontExample', kind: 'text', side: 'front' },
    { fieldKey: 'examples', kind: 'text-list', side: 'back' },
  ],
  noteType: { key: 'english-coach-fixture', layoutVersion: 1 },
});

// F07: this profile intentionally has no English Coach fields or audio.
export const questionAnswerProfileFixture = generationProfileSchema.parse({
  ref: { id: 'question-answer', version: 'fixture-1' },
  name: 'Question and answer (fixture)',
  prompt: {
    version: 'fixture-1',
    text: 'Synthetic question and answer fixture; not a production generation prompt.',
    source: {
      kind: 'fixture',
      reference: 'docs/AI_EVALUATION.md#input-and-response-fixtures',
    },
  },
  fields: [
    {
      kind: 'text',
      key: 'question',
      label: 'Question',
      required: true,
      nullable: false,
    },
    {
      kind: 'text',
      key: 'answer',
      label: 'Answer',
      required: true,
      nullable: false,
    },
  ],
  layout: {
    front: [
      {
        kind: 'field',
        fieldKey: 'question',
        heading: null,
        format: 'plain',
        omitWhenNull: false,
      },
    ],
    back: [
      {
        kind: 'field',
        fieldKey: 'answer',
        heading: null,
        format: 'plain',
        omitWhenNull: false,
      },
    ],
  },
  audioSelectors: [],
  noteType: { key: 'question-answer-fixture', layoutVersion: 1 },
});
