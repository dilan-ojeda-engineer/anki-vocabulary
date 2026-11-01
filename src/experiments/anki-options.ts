import { parseArgs } from 'node:util';
import { z } from 'zod';
import { validateEndpoint } from '../integrations/anki/client';

const optionsSchema = z
  .strictObject({
    run: z.boolean(),
    resume: z.string().uuid().optional(),
    preview: z.string().uuid().optional(),
    'disposable-profile': z
      .string()
      .refine((value) => value.trim().length > 0)
      .optional(),
    'addon-revision': z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .optional(),
    endpoint: z.string(),
  })
  .superRefine((values, context) => {
    const modes = [values.run, values.resume, values.preview].filter(
      Boolean,
    ).length;
    if (modes > 1)
      context.addIssue({
        code: 'custom',
        message: 'Choose only one of --run, --resume, or --preview.',
      });
    if (modes > 0 && !values['disposable-profile'])
      context.addIssue({
        code: 'custom',
        message:
          'Name the disposable profile explicitly before any write or preview.',
      });
  })
  .readonly();

/** Pure startup validation: callers must run this before I/O or lock creation. */
export function parseAnkiOptions(args: string[] = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    options: {
      run: { type: 'boolean', default: false },
      resume: { type: 'string' },
      preview: { type: 'string' },
      'disposable-profile': { type: 'string' },
      'addon-revision': { type: 'string' },
      endpoint: { type: 'string', default: 'http://127.0.0.1:18765/api/v1' },
    },
  });
  const parsed = optionsSchema.parse(values);
  validateEndpoint(parsed.endpoint);
  return parsed;
}
