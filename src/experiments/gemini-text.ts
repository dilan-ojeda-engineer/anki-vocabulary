import { z } from 'zod';

export const geminiModel = 'gemini-3.8-flash';
export const geminiModelSchema = z.literal(geminiModel);
export const geminiSettings = {
  temperature: 0.2,
  maxOutputTokens: 4096,
  candidateCount: 1,
  thinkingConfig: { thinkingLevel: 'LOW', includeThoughts: false },
} as const;

const usageSchema = z.object({
  promptTokenCount: z.number().int().nonnegative(),
  candidatesTokenCount: z.number().int().nonnegative().optional(),
  thoughtsTokenCount: z.number().int().nonnegative().optional(),
  totalTokenCount: z.number().int().nonnegative(),
  cachedContentTokenCount: z.number().int().nonnegative().optional(),
});
const envelopeSchema = z.object({
  responseId: z.string().optional(),
  modelVersion: z.string().optional(),
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  usageMetadata: usageSchema.optional(),
  candidates: z
    .array(
      z.object({
        finishReason: z.string(),
        content: z
          .object({
            parts: z.array(
              z.object({ text: z.string(), thought: z.boolean().optional() }),
            ),
          })
          .optional(),
      }),
    )
    .max(1)
    .optional(),
});

/** The native API documents a JSON Schema subset; local validation still enforces nonempty text. */
export function createGeminiTransportSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(createGeminiTransportSchema);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'minLength')
        .map(([key, item]) => [
          key,
          key === 'properties' &&
          item &&
          typeof item === 'object' &&
          !Array.isArray(item)
            ? Object.fromEntries(
                Object.entries(item).map(([field, schema]) => [
                  field,
                  createGeminiTransportSchema(schema),
                ]),
              )
            : createGeminiTransportSchema(item),
        ]),
    );
  return value;
}

/** One native request, no automatic retry or provider/model fallback. */
export async function requestGeminiText(options: {
  apiKey: string;
  prompt: string;
  input: { target: string; context: string | null };
  schema: unknown;
  fetcher?: typeof fetch;
}) {
  if (!options.apiKey.trim())
    throw new Error('Configure GEMINI_API_KEY locally.');
  const start = performance.now();
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
      {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(120_000),
        headers: {
          'x-goog-api-key': options.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: options.prompt }] },
          contents: [
            { role: 'user', parts: [{ text: JSON.stringify(options.input) }] },
          ],
          generationConfig: {
            ...geminiSettings,
            responseMimeType: 'application/json',
            responseJsonSchema: options.schema,
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
      latencyMs: performance.now() - start,
    };
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      status: 'invalid-envelope' as const,
      latencyMs: performance.now() - start,
    };
  }
  const latencyMs = performance.now() - start;
  const parsed = envelopeSchema.safeParse(payload);
  if (!parsed.success)
    return { status: 'invalid-envelope' as const, latencyMs };
  const result = parsed.data;
  const details = result.usageMetadata;
  const metadata = {
    latencyMs,
    requestId: result.responseId ?? null,
    model: result.modelVersion ?? null,
    usage: details
      ? {
          prompt_tokens: details.promptTokenCount,
          completion_tokens:
            (details.candidatesTokenCount ?? 0) +
            (details.thoughtsTokenCount ?? 0),
          total_tokens: details.totalTokenCount,
        }
      : null,
    usageDetails: details ?? null,
  };
  if (result.promptFeedback?.blockReason)
    return { status: 'refused' as const, ...metadata };
  const candidate = result.candidates?.[0];
  if (!candidate) return { status: 'invalid-envelope' as const, ...metadata };
  const content =
    candidate.content?.parts
      .filter((part) => !part.thought)
      .map((part) => part.text)
      .join('') ?? '';
  if (candidate.finishReason !== 'STOP')
    return {
      status: 'incomplete' as const,
      ...metadata,
      finishReason: candidate.finishReason,
      rawContent: content,
    };
  if (!content || !result.modelVersion)
    return { status: 'invalid-envelope' as const, ...metadata };
  return { status: 'completed' as const, ...metadata, content };
}
