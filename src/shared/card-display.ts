import { createEnglishCoachProfile } from '../profiles/english-coach';
import { createFieldValuesSchema } from './contracts';

const profile = createEnglishCoachProfile('Card display only');
export const coachFieldSchema = createFieldValuesSchema(profile);
export const coachFields = profile.fields;

export function cardSides(input: unknown): { front: string; back: string } {
  const f = coachFieldSchema.parse(input) as Record<
    string,
    string | string[] | null
  >;
  const list = (key: string) =>
    (f[key] as string[]).map((item) => `- ${item}`).join('\n');
  const front = `${f.target}\n“${f.frontExample}”\nWhat does this expression mean?`;
  const back = [
    `Meaning:\n${f.meaning}`,
    `Category:\n${f.category}`,
    ...(f.irregularForms ? [`Irregular Forms:\n${f.irregularForms}`] : []),
    `Pronunciation tip:\nNative English:\n${f.nativePronunciation}\nFor Spanish speakers:\n${f.spanishPronunciation}`,
    `More examples:\n${list('examples')}`,
    `Common collocations/chunks:\n${list('chunks')}`,
    `Common mistake and usage note:\n${f.usageNote}`,
    `Natural alternatives:\n${list('alternatives')}`,
    `Spanish Translation:\n${f.spanishTranslation}`,
  ].join('\n');
  return { front, back };
}

export function cardText(input: unknown): string {
  const { front, back } = cardSides(input);
  return `${front}\n${back}`;
}
