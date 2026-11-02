import { describe, expect, it } from 'vitest';
import {
  requestGeminiText,
  createGeminiTransportSchema,
} from '../../src/experiments/gemini-text';
import { createEnglishCoachProfile } from '../../src/profiles/english-coach';
import {
  createTextJsonSchema,
  validateTextResponse,
} from '../../src/experiments/text-response';

const options = {
  apiKey: 'fake-gemini-secret',
  prompt: 'Exact teaching prompt',
  input: { target: 'went', context: 'I went to the office yesterday.' },
  schema: { type: 'object' },
};
describe('Gemini native experiment (fake transport)', () => {
  it('sends the unchanged prompt/input to the fixed native endpoint with a header-only key', async () => {
    const result = await requestGeminiText({
      ...options,
      fetcher: async (url, init) => {
        expect(url).toBe(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
        );
        expect(String(url)).not.toContain(options.apiKey);
        expect(init?.headers).toMatchObject({
          'x-goog-api-key': options.apiKey,
        });
        const body = JSON.parse(String(init?.body));
        expect(body.systemInstruction.parts[0].text).toBe(options.prompt);
        expect(JSON.parse(body.contents[0].parts[0].text)).toEqual(
          options.input,
        );
        expect(body.generationConfig).toMatchObject({
          temperature: 0.2,
          maxOutputTokens: 4096,
          candidateCount: 1,
          responseJsonSchema: options.schema,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: 'LOW', includeThoughts: false },
        });
        return new Response(
          JSON.stringify({
            modelVersion: 'gemini-3.8-flash',
            responseId: 'fake-id',
            candidates: [
              {
                finishReason: 'STOP',
                content: {
                  parts: [
                    { text: 'private reasoning', thought: true },
                    { text: '{"fields":' },
                    { text: '{}}' },
                  ],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 20,
              thoughtsTokenCount: 5,
              totalTokenCount: 35,
            },
          }),
        );
      },
    });
    expect(result).toMatchObject({
      status: 'completed',
      content: '{"fields":{}}',
      requestId: 'fake-id',
      usage: { prompt_tokens: 10, completion_tokens: 25, total_tokens: 35 },
    });
    expect(JSON.stringify(result)).not.toContain('private reasoning');
  });
  it('stops on quota without retries or storing the error body', async () => {
    let calls = 0;
    const result = await requestGeminiText({
      ...options,
      fetcher: async () => {
        calls++;
        return new Response(options.apiKey, { status: 429 });
      },
    });
    expect(calls).toBe(1);
    expect(result).toMatchObject({
      status: 'provider-error',
      category: 'quota-or-rate-limit',
    });
    expect(JSON.stringify(result)).not.toContain(options.apiKey);
  });
  it('rejects a prompt block without manufacturing content', async () => {
    const result = await requestGeminiText({
      ...options,
      fetcher: async () =>
        new Response(
          JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }),
        ),
    });
    expect(result.status).toBe('refused');
    expect(result).not.toHaveProperty('content');
  });
  it('retains truncated text as unvalidated raw content', async () => {
    const result = await requestGeminiText({
      ...options,
      fetcher: async () =>
        new Response(
          JSON.stringify({
            modelVersion: 'gemini-3.8-flash',
            candidates: [
              {
                finishReason: 'MAX_TOKENS',
                content: { parts: [{ text: '{partial' }] },
              },
            ],
          }),
        ),
    });
    expect(result).toMatchObject({
      status: 'incomplete',
      rawContent: '{partial',
    });
    expect(result).not.toHaveProperty('content');
  });
  it('sanitizes malformed envelopes and transport exceptions', async () => {
    const malformed = await requestGeminiText({
      ...options,
      fetcher: async () => new Response('not-json'),
    });
    const failed = await requestGeminiText({
      ...options,
      fetcher: async () => {
        throw new Error(options.apiKey);
      },
    });
    expect(malformed.status).toBe('invalid-envelope');
    expect(failed.status).toBe('transport-error');
    expect(JSON.stringify(failed)).not.toContain(options.apiKey);
  });
  it('adapts schema keywords without deleting named fields or weakening local validation', () => {
    expect(
      createGeminiTransportSchema({
        type: 'object',
        properties: { minLength: { type: 'string', minLength: 1 } },
      }),
    ).toEqual({
      type: 'object',
      properties: { minLength: { type: 'string' } },
    });
    const profile = createEnglishCoachProfile('Test');
    const schema = createTextJsonSchema(profile);
    const native = createGeminiTransportSchema(schema);
    expect(JSON.stringify(native)).not.toContain('"minLength":1');
    expect(native).toMatchObject({
      properties: {
        fields: {
          properties: {
            examples: { minItems: 4, maxItems: 5 },
            spanishTranslation: { type: 'string' },
          },
        },
      },
    });
    expect(
      validateTextResponse(
        profile,
        JSON.stringify({ fields: { target: ' ' }, corrections: [] }),
      ).status,
    ).toBe('invalid-fields');
  });
});
