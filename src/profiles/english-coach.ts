import { generationProfileSchema } from '../shared/contracts';

// English Coach AV-005 snapshot, derived from the AV-003 field/layout contract.
export function createEnglishCoachProfile(
  prompt: string,
  version:
    'av005-1' | 'av005-2' | 'av005-3' | 'av005-4' | 'av005-5' = 'av005-5',
) {
  const historical = generationProfileSchema.parse({
    ref: { id: 'english-coach', version },
    name: 'English Coach',
    prompt: {
      version,
      text: prompt,
      source: {
        kind: 'archived-user-prompt',
        reference: 'docs/prompts/english-coach-user-2026-11-01.txt',
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
        minItems: 4,
        maxItems: 5,
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
    noteType: { key: 'english-coach', layoutVersion: 1 },
  });
  if (version === 'av005-1' || version === 'av005-2') return historical;
  if (version === 'av005-5')
    return generationProfileSchema.parse({
      ...historical,
      noteType: { key: 'english-coach-english-explanations', layoutVersion: 4 },
    });
  const excluded = new Set(
    version === 'av005-3'
      ? ['spanishPronunciation', 'spanishTranslation']
      : ['spanishTranslation'],
  );
  return generationProfileSchema.parse({
    ...historical,
    fields: historical.fields.filter((field) => !excluded.has(field.key)),
    layout: {
      ...historical.layout,
      back: historical.layout.back
        .filter(
          (block) => block.kind !== 'field' || !excluded.has(block.fieldKey),
        )
        .map((block) =>
          block.kind === 'group'
            ? {
                ...block,
                fields: block.fields.filter(
                  (field) => !excluded.has(field.fieldKey),
                ),
              }
            : block,
        ),
    },
    noteType:
      version === 'av005-3'
        ? { key: 'english-coach-english-only', layoutVersion: 2 }
        : { key: 'english-coach-english-guidance', layoutVersion: 3 },
  });
}
