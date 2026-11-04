import type { Workspace } from '../shared/card-import';
import { coachFieldSchema } from '../shared/card-display';

export const sourceFields = [
  'Target',
  'FrontExample',
  'Meaning',
  'Category',
  'IrregularForms',
  'NativePronunciation',
  'SpanishPronunciation',
  'Example1',
  'Example2',
  'Example3',
  'Example4',
  'Example5',
  'Chunks',
  'UsageNote',
  'Alternatives',
  'SpanishTranslation',
];
export const ankiFieldNames = [
  'AvSourceId',
  'AvRevision',
  'AvContentHash',
  'AvProfileVersion',
  'AvContent',
  ...sourceFields,
  'AudioTarget',
  'AudioFrontExample',
  'AudioExample1',
  'AudioExample2',
  'AudioExample3',
  'AudioExample4',
  'AudioExample5',
];
export const audioFieldName = (placement: string) =>
  placement === 'target'
    ? 'AudioTarget'
    : placement === 'frontExample'
      ? 'AudioFrontExample'
      : `AudioExample${Number(placement.split(':')[1]) + 1}`;
export const escapeAnki = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('[', '&#91;')
    .replaceAll(']', '&#93;')
    .replaceAll('\n', '<br>');
export const ankiTemplate = {
  name: 'English Coach',
  questionHtml:
    '<div class="target">{{Target}} {{AudioTarget}}</div><p>“{{FrontExample}}” {{AudioFrontExample}}</p><p>What does this expression mean?</p>',
  answerHtml:
    '<b>Meaning:</b><div>{{Meaning}}</div><b>Category:</b><div>{{Category}}</div>{{#IrregularForms}}<b>Irregular Forms:</b><div>{{IrregularForms}}</div>{{/IrregularForms}}<b>Pronunciation tip:</b><div>Native English:</div><div>{{NativePronunciation}}</div><div>For Spanish speakers:</div><div>{{SpanishPronunciation}}</div><b>More examples:</b>' +
    [1, 2, 3, 4, 5]
      .map(
        (i) =>
          `{{#Example${i}}}<div>• {{Example${i}}} {{AudioExample${i}}}</div>{{/Example${i}}}`,
      )
      .join('') +
    '<b>Common collocations/chunks:</b><div>{{Chunks}}</div><b>Common mistake and usage note:</b><div>{{UsageNote}}</div><b>Natural alternatives:</b><div>{{Alternatives}}</div><b>Spanish Translation:</b><div>{{SpanishTranslation}}</div>',
};
export const ankiCss =
  '.card { font-family: Arial, sans-serif; font-size: 20px; text-align: left; line-height: 1.6; } .target { font-size: 30px; font-weight: bold; } b { display: block; margin-top: 14px; }';

export function ankiFields(
  card: Workspace['cards'][number],
  audio: Record<string, string>,
) {
  const fields = coachFieldSchema.parse(card.fields);
  const result: Record<string, string> = Object.fromEntries(
    ankiFieldNames.map((name) => [name, '']),
  );
  Object.assign(result, {
    AvSourceId: card.id,
    AvRevision: String(card.revision),
    AvContentHash: card.contentHash,
    AvProfileVersion: card.profileVersion,
    AvContent: Buffer.from(JSON.stringify(fields)).toString('base64'),
  });
  const mapping = {
    target: 'Target',
    frontExample: 'FrontExample',
    meaning: 'Meaning',
    category: 'Category',
    irregularForms: 'IrregularForms',
    nativePronunciation: 'NativePronunciation',
    spanishPronunciation: 'SpanishPronunciation',
    usageNote: 'UsageNote',
    spanishTranslation: 'SpanishTranslation',
  };
  for (const [key, name] of Object.entries(mapping))
    result[name] = escapeAnki(String(fields[key] ?? ''));
  for (const [index, text] of (fields.examples as string[]).entries())
    result[`Example${index + 1}`] = escapeAnki(text);
  for (const [key, name] of [
    ['chunks', 'Chunks'],
    ['alternatives', 'Alternatives'],
  ])
    result[name!] = (fields[key!] as string[])
      .map((text) => `• ${escapeAnki(text)}`)
      .join('<br>');
  for (const [placement, filename] of Object.entries(audio))
    result[audioFieldName(placement)] = `[sound:${filename}]`;
  return result;
}
