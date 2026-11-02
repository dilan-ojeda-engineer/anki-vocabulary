import { z } from 'zod';

export const groqModel = 'openai/gpt-oss-120b';
export const groqModelSchema = z.enum([groqModel, 'qwen/qwen3.8-27b']);
export const groqSettings = {
  temperature: 0.2,
  max_completion_tokens: 4096,
  reasoning_effort: 'low',
} as const;
const completionSchema = z.object({
  id: z.string(),
  model: z.string(),
  choices: z
    .array(
      z.object({
        finish_reason: z.string(),
        message: z.object({
          content: z.string().nullable(),
          refusal: z.string().nullable().optional(),
        }),
      }),
    )
    .length(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative(),
      completion_tokens: z.number().int().nonnegative(),
      total_tokens: z.number().int().nonnegative(),
    })
    .optional(),
});

/** No retries or fallback: the experiment records one attempt per selected case. */
export async function requestGroqText(options: {
  apiKey: string;
  prompt: string;
  input: { target: string; context: string | null };
  schema: unknown;
  model?: z.infer<typeof groqModelSchema>;
  fetcher?: typeof fetch;
}) {
  const model = groqModelSchema.parse(options.model ?? groqModel);
  if (!options.apiKey.trim())
    throw new Error('Configure GROQ_API_KEY locally.');
  const start = performance.now();
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(120_000),
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          ...groqSettings,
          stream: false,
          messages: [
            { role: 'system', content: options.prompt },
            { role: 'user', content: JSON.stringify(options.input) },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'english_coach_card',
              strict: true,
              schema: options.schema,
            },
          },
        }),
      },
    );
  } catch {
    return {
      status: 'transport-error' as const,
      latencyMs: performance.now() - start,
    };
  }
  let latencyMs = performance.now() - start;
  if (!response.ok)
    return {
      status: 'provider-error' as const,
      httpStatus: response.status,
      category:
        response.status === 429
          ? 'quota-or-rate-limit'
          : response.status === 401 || response.status === 403
            ? 'authentication-or-access'
            : 'service-or-request',
      retryAfter: response.headers.get('retry-after'),
      latencyMs,
    };
  // Never persist arbitrary envelopes: a server/error body may echo sensitive data.
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      status: 'invalid-envelope' as const,
      latencyMs: performance.now() - start,
    };
  }
  latencyMs = performance.now() - start;
  const result = completionSchema.safeParse(payload);
  if (!result.success)
    return { status: 'invalid-envelope' as const, latencyMs };
  const choice = result.data.choices[0]!;
  const metadata = {
    latencyMs,
    requestId: result.data.id,
    model: result.data.model,
    usage: result.data.usage ?? null,
  };
  if (choice.message.refusal)
    return {
      status: 'refused' as const,
      ...metadata,
      refusal: choice.message.refusal,
    };
  if (choice.finish_reason !== 'stop')
    return {
      status: 'incomplete' as const,
      finishReason: choice.finish_reason,
      ...metadata,
      rawContent: choice.message.content,
    };
  if (!choice.message.content)
    return { status: 'invalid-envelope' as const, latencyMs };
  return {
    status: 'completed' as const,
    content: choice.message.content,
    requestId: result.data.id,
    model: result.data.model,
    usage: result.data.usage ?? null,
    latencyMs,
  };
}
