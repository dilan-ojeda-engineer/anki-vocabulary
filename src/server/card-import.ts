import { createEnglishCoachProfile } from '../profiles/english-coach';
import { createFieldValuesSchema } from '../shared/contracts';
import type { ImportPreview, ImportRequest } from '../shared/card-import';

const profile = createEnglishCoachProfile('Import validation only');
const fieldsSchema = createFieldValuesSchema(profile);
const keys = profile.fields.map((field) => field.key);
const headings: [string, string][] = [
  ['Meaning:', 'meaning'],
  ['Category:', 'category'],
  ['Irregular Forms:', 'irregularForms'],
  ['Pronunciation tip:', 'pronunciationTip'],
  ['Native English:', 'nativePronunciation'],
  ['For Spanish speakers:', 'spanishPronunciation'],
  ['More examples:', 'examples'],
  ['Common collocations/chunks:', 'chunks'],
  ['Common mistake and usage note:', 'usageNote'],
  ['Natural alternatives:', 'alternatives'],
  ['Spanish Translation:', 'spanishTranslation'],
];
const lists = new Set(['examples', 'chunks', 'alternatives']);

function splitDelimited(
  text: string,
  delimiter: string,
): { cells: string[]; raw: string; error?: string }[] {
  const rows: { cells: string[]; raw: string; error?: string }[] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let rowStart = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (cell === '' || quoted) quoted = !quoted;
      else cell += char;
    } else if (!quoted && char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push({
        cells: row,
        raw: text.slice(
          rowStart,
          i + (char === '\r' && text[i] === '\n' ? -1 : 0),
        ),
      });
      row = [];
      cell = '';
      rowStart = i + 1;
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push({
      cells: row,
      raw: text.slice(rowStart),
      ...(quoted ? { error: 'Unclosed quoted field.' } : {}),
    });
  }
  return rows;
}

function parsePasteCard(raw: string): Record<string, unknown> {
  const lines = raw.trim().split(/\r?\n/);
  const target = lines.shift()?.trim() ?? '';
  const frontExample = (lines.shift()?.trim() ?? '').replace(
    /^[“"]|[”"]$/g,
    '',
  );
  if (lines.shift()?.trim() !== 'What does this expression mean?')
    throw new Error('Expected the official front-side question on line 3.');
  const result: Record<string, unknown> = {
    target,
    frontExample,
    irregularForms: null,
  };
  let current = '';
  let previous = -1;
  const seen = new Set<string>();
  for (const line of lines) {
    const trimmed = line.trim();
    const headingIndex = headings.findIndex(
      ([heading]) => trimmed === heading || trimmed.startsWith(`${heading} `),
    );
    if (headingIndex >= 0) {
      if (headingIndex <= previous)
        throw new Error('Back headings are missing or out of order.');
      previous = headingIndex;
      const heading = headings[headingIndex]!;
      current = heading[1];
      seen.add(current);
      if (current !== 'pronunciationTip')
        result[current] = trimmed.slice(heading[0].length).trim();
    } else if (trimmed) {
      if (!current || current === 'pronunciationTip')
        throw new Error('Content appears outside a field.');
      const value = String(result[current] ?? '');
      result[current] = `${value}${value ? '\n' : ''}${trimmed}`;
    }
  }
  if (headings.some(([, key]) => key !== 'irregularForms' && !seen.has(key)))
    throw new Error('An official back heading is missing.');
  for (const key of lists) {
    const value = result[key];
    if (
      typeof value === 'string' &&
      value.split('\n').some((line) => line && !/^[-*]\s+/.test(line))
    )
      throw new Error(`${key} items must use bullet lines.`);
    result[key] =
      typeof value === 'string'
        ? value
            .split('\n')
            .map((item) => item.replace(/^[-*]\s*/, '').trim())
            .filter(Boolean)
        : [];
  }
  delete result.pronunciationTip;
  return result;
}

function candidates(
  request: ImportRequest,
): { originalText: string; fields: unknown; error?: string }[] {
  if (request.format === 'paste')
    return request.text
      .split(/^---\s*$/m)
      .filter((part) => part.trim())
      .map((part) => ({ originalText: part, fields: part }));
  if (request.format === 'json') {
    const parsed: unknown = JSON.parse(request.text);
    if (!Array.isArray(parsed))
      throw new Error('JSON must be an array of card field objects.');
    return parsed.map((item) => ({
      originalText: request.text,
      fields: item,
    }));
  }
  const rows = splitDelimited(
    request.text,
    request.format === 'csv' ? ',' : '\t',
  );
  const header = rows.shift()?.cells.map((item) => item.trim()) ?? [];
  if (
    new Set(header).size !== header.length ||
    header.some((key) => !keys.includes(key)) ||
    keys.some((key) => !header.includes(key))
  )
    throw new Error(
      `Header must contain each English Coach field exactly once: ${keys.join(', ')}.`,
    );
  return rows
    .filter((row) => row.cells.some((cell) => cell.trim()))
    .map((row) => {
      const fields: Record<string, unknown> = {};
      for (let i = 0; i < header.length; i++) {
        const key = header[i]!;
        const value = row.cells[i] ?? '';
        if (lists.has(key)) {
          try {
            fields[key] = JSON.parse(value);
          } catch {
            fields[key] = value;
          }
        } else
          fields[key] = key === 'irregularForms' && value === '' ? null : value;
      }
      return {
        originalText: row.raw,
        fields,
        ...(row.error
          ? { error: row.error }
          : row.cells.length !== header.length
            ? { error: 'Column count differs from header.' }
            : {}),
      };
    });
}

export function previewImport(request: ImportRequest): ImportPreview {
  let items: ReturnType<typeof candidates>;
  try {
    items = candidates(request);
  } catch (error) {
    return {
      entries: [
        {
          index: 1,
          originalText: request.text,
          fields: null,
          issues: [
            {
              path: '',
              message:
                error instanceof Error ? error.message : 'Invalid input.',
            },
          ],
        },
      ],
    };
  }
  return {
    entries: items.map((item, index) => {
      let fields = item.fields;
      try {
        if (request.format === 'paste') fields = parsePasteCard(String(fields));
      } catch (error) {
        return {
          index: index + 1,
          originalText: item.originalText,
          fields: null,
          issues: [
            {
              path: '',
              message: error instanceof Error ? error.message : 'Invalid card.',
            },
          ],
        };
      }
      const result = fieldsSchema.safeParse(fields);
      return {
        index: index + 1,
        originalText: item.originalText,
        fields: result.success ? result.data : null,
        issues: [
          ...(item.error ? [{ path: '', message: item.error }] : []),
          ...(!result.success
            ? result.error.issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message,
              }))
            : []),
        ],
      };
    }),
  };
}
