import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { setTimeout } from 'node:timers/promises';
import { createEnglishCoachProfile } from '../profiles/english-coach';
import {
  groqModel,
  groqModelSchema,
  groqSettings,
  requestGroqText,
} from './groq-text';
import { textCases } from './text-cases';
import { createTextJsonSchema, validateTextResponse } from './text-response';
import { checkTextExpectations } from './text-expectations';
import {
  geminiModel,
  geminiModelSchema,
  geminiSettings,
  createGeminiTransportSchema,
  requestGeminiText,
} from './gemini-text';

const { values } = parseArgs({
  options: {
    run: { type: 'boolean', default: false },
    'free-allowance-confirmed': { type: 'boolean', default: false },
    cases: { type: 'string', default: 'P01,P02,P03,P04,P05' },
    'interval-ms': { type: 'string', default: '35000' },
    'prompt-version': { type: 'string', default: 'av005-5' },
    model: { type: 'string' },
    provider: { type: 'string', default: 'groq' },
  },
});
if (values.provider !== 'groq' && values.provider !== 'gemini')
  throw new Error('Choose provider groq or gemini.');
const provider = values.provider;
const selectedModel =
  provider === 'groq'
    ? groqModelSchema.parse(values.model ?? groqModel)
    : geminiModelSchema.parse(values.model ?? geminiModel);
const settings = provider === 'groq' ? groqSettings : geminiSettings;
const promptVersion = values['prompt-version'];
if (
  promptVersion !== 'av005-1' &&
  promptVersion !== 'av005-2' &&
  promptVersion !== 'av005-3' &&
  promptVersion !== 'av005-4' &&
  promptVersion !== 'av005-5'
)
  throw new Error(
    'Choose prompt-version av005-1, av005-2, av005-3, av005-4, or av005-5.',
  );
const intervalMs = Number(values['interval-ms']);
if (!Number.isSafeInteger(intervalMs) || intervalMs < 0 || intervalMs > 60_000)
  throw new Error('interval-ms must be an integer from 0 through 60000.');
const selected = values.cases.split(',');
if (
  new Set(selected).size !== selected.length ||
  selected.some((id) => !textCases.some((item) => item.id === id))
)
  throw new Error('Select unique known P01–P05 or Q01–Q08 case IDs.');
if (values.run && !values['free-allowance-confirmed'])
  throw new Error(
    'Confirm the account owner’s free allowance before live calls.',
  );
const archive = await readFile(
  'docs/prompts/english-coach-user-2026-11-01.txt',
  'utf8',
);
const adaptation = await readFile(
  'docs/prompts/english-coach-av005-1.md',
  'utf8',
);
// Teaching instructions precede WORD LIST; actual inputs are separate user data.
const revision =
  promptVersion === 'av005-2'
    ? await readFile('docs/prompts/english-coach-av005-2.md', 'utf8')
    : '';
const prompt =
  promptVersion === 'av005-3' ||
  promptVersion === 'av005-4' ||
  promptVersion === 'av005-5'
    ? await readFile(`docs/prompts/english-coach-${promptVersion}.md`, 'utf8')
    : archive.split('## WORD LIST')[0] +
      '\n\n' +
      adaptation +
      (revision ? '\n\n' + revision : '');
const profile = createEnglishCoachProfile(prompt, promptVersion);
const schema = createTextJsonSchema(profile);
const transportSchema =
  provider === 'gemini' ? createGeminiTransportSchema(schema) : schema;
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
if (!values.run) {
  console.log(
    JSON.stringify({
      mode: 'offline-plan',
      cases: selected,
      model: selectedModel,
      provider,
      profile: profile.ref,
      promptHash: hash(prompt),
      examples: '4–5',
      liveCalls: 0,
    }),
  );
} else {
  // Environment configuration only; no key is persisted or sent to React.
  const keyName = provider === 'groq' ? 'GROQ_API_KEY' : 'GEMINI_API_KEY';
  const apiKey = process.env[keyName];
  if (!apiKey) throw new Error(`${keyName} is unavailable in this process.`);
  const runId = randomUUID();
  const directory = join('.tools', 'av005-evidence', runId);
  await mkdir(directory, { recursive: true });
  const record = {
    runId,
    createdAt: new Date().toISOString(),
    datasetVersion: '0.1',
    profile,
    promptHash: hash(prompt),
    archiveHash: hash(archive),
    schemaHash: hash(JSON.stringify(schema)),
    transportSchemaHash: hash(JSON.stringify(transportSchema)),
    transportSchema,
    provider,
    model: selectedModel,
    settings,
    requestedCases: selected,
    sourceExpectationReview: 'pending-human-review',
    linguisticReview: 'pending',
    repairs: 0,
    retries: 0,
    intervalMs,
    results: [] as unknown[],
  };
  await writeFile(
    join(directory, 'run.json'),
    JSON.stringify(record, null, 2),
    { flag: 'wx' },
  );
  for (const id of selected) {
    if (record.results.length > 0) await setTimeout(intervalMs);
    const input = textCases.find((item) => item.id === id)!;
    const response =
      provider === 'gemini'
        ? await requestGeminiText({
            apiKey,
            prompt,
            input,
            schema: transportSchema,
          })
        : await requestGroqText({
            apiKey,
            prompt,
            input,
            schema,
            model: groqModelSchema.parse(selectedModel),
          });
    const validation =
      response.status === 'completed'
        ? validateTextResponse(profile, response.content)
        : null;
    // Raw content is retained only for these explicitly synthetic evaluation inputs.
    const item = {
      id,
      input,
      response,
      validation,
      expectationChecks:
        validation?.status === 'structurally-valid'
          ? checkTextExpectations(id, validation.value.fields)
          : null,
      editedRevision: null,
      correctionNotes: [],
      finalReview: 'pending',
    };
    await writeFile(
      join(directory, `${id}.json`),
      JSON.stringify(item, null, 2),
      { flag: 'wx' },
    );
    record.results.push(item);
    await writeFile(
      join(directory, 'run.json'),
      JSON.stringify(record, null, 2),
    );
    console.log(
      JSON.stringify({
        runId,
        case: id,
        response: response.status,
        validation: validation?.status ?? null,
      }),
    );
    if (response.status !== 'completed') break;
  }
  console.log(
    JSON.stringify({
      evidence: directory,
      completedAttempts: record.results.length,
      candidateDecision: 'unresolved-pending-content-review',
    }),
  );
}
