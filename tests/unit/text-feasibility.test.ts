import { describe, expect, it, vi } from 'vitest';
import {
  englishCoachProfileFixture,
  questionAnswerProfileFixture,
} from '../../src/shared/fixtures/profiles';
import {
  createTextJsonSchema,
  validateTextResponse,
} from '../../src/experiments/text-response';
import {
  requestGroqText,
  groqModelSchema,
} from '../../src/experiments/groq-text';
import { textCases } from '../../src/experiments/text-cases';
import { createEnglishCoachProfile } from '../../src/profiles/english-coach';
import { checkTextExpectations } from '../../src/experiments/text-expectations';

describe('text feasibility boundaries (fake transport)', () => {
  it('selects only an explicit supported comparison model without changing prompt or request settings', async () => {
    expect(groqModelSchema.safeParse('unapproved/model').success).toBe(false);
    let calls = 0;
    const result = await requestGroqText({
      apiKey: 'fake',
      model: 'qwen/qwen3.8-27b',
      prompt: 'Unchanged prompt',
      input: { target: 'went', context: 'I went to the office yesterday.' },
      schema: { type: 'object' },
      fetcher: async (_url, init) => {
        calls++;
        const body = JSON.parse(String(init?.body));
        expect(body.model).toBe('qwen/qwen3.8-27b');
        expect(body.messages[0].content).toBe('Unchanged prompt');
        expect(body).toMatchObject({
          temperature: 0.2,
          max_completion_tokens: 4096,
          reasoning_effort: 'low',
        });
        expect(body.response_format.json_schema.strict).toBe(true);
        return new Response(
          JSON.stringify({
            id: 'fake-qwen',
            model: 'qwen/qwen3.8-27b',
            choices: [{ finish_reason: 'stop', message: { content: '{}' } }],
          }),
        );
      },
    });
    expect(calls).toBe(1);
    expect(result).toMatchObject({
      status: 'completed',
      model: 'qwen/qwen3.8-27b',
    });
  });
  it('preserves every official back heading in order and requires the translation', () => {
    const profile = createEnglishCoachProfile('Official structure test');
    expect(profile.ref.version).toBe('av005-5');
    const headings = profile.layout.back.flatMap((block) =>
      block.kind === 'group'
        ? [block.heading, ...block.fields.map((field) => field.heading)]
        : block.kind === 'field'
          ? [block.heading]
          : [],
    );
    expect(headings).toEqual([
      'Meaning:',
      'Category:',
      'Irregular Forms:',
      'Pronunciation tip:',
      'Native English:',
      'For Spanish speakers:',
      'More examples:',
      'Common collocations/chunks:',
      'Common mistake and usage note:',
      'Natural alternatives:',
      'Spanish Translation:',
    ]);
    const fields = Object.fromEntries(
      profile.fields.map((field) => [
        field.key,
        field.kind === 'text-list'
          ? Array.from({ length: field.minItems }, () => 'An English example.')
          : field.nullable
            ? null
            : 'English explanation.',
      ]),
    );
    fields.spanishTranslation = 'una traducción contextual';
    expect(
      validateTextResponse(profile, JSON.stringify({ fields, corrections: [] }))
        .status,
    ).toBe('structurally-valid');
    const { spanishTranslation: removed, ...missingTranslation } = fields;
    expect(removed).toBe('una traducción contextual');
    expect(
      validateTextResponse(
        profile,
        JSON.stringify({ fields: missingTranslation, corrections: [] }),
      ).status,
    ).toBe('invalid-fields');
  });
  it('requires English-written audience pronunciation guidance in the new default without translations', () => {
    const profile = createEnglishCoachProfile(
      'English-written guidance test',
      'av005-4',
    );
    expect(profile.ref.version).toBe('av005-4');
    const fields = Object.fromEntries(
      profile.fields.map((field) => [
        field.key,
        field.kind === 'text-list'
          ? Array.from({ length: field.minItems }, () => 'An English example.')
          : field.kind === 'text' && field.nullable
            ? null
            : 'English text.',
      ]),
    );
    expect(JSON.stringify(profile.layout)).toContain('For Spanish speakers:');
    expect(
      validateTextResponse(profile, JSON.stringify({ fields, corrections: [] }))
        .status,
    ).toBe('structurally-valid');
    const { spanishPronunciation: removed, ...missingGuidance } = fields;
    expect(removed).toBe('English text.');
    expect(
      validateTextResponse(
        profile,
        JSON.stringify({ fields: missingGuidance, corrections: [] }),
      ).status,
    ).toBe('invalid-fields');
    expect(
      validateTextResponse(
        profile,
        JSON.stringify({
          fields: { ...fields, spanishTranslation: 'translation' },
          corrections: [],
        }),
      ).status,
    ).toBe('invalid-fields');
  });
  it('excludes Spanish fields/layout from the English-only version while preserving historical profiles', () => {
    const current = createEnglishCoachProfile('English-only test', 'av005-3');
    const historic = createEnglishCoachProfile('Historical test', 'av005-2');
    expect(current.ref.version).toBe('av005-3');
    expect(current.fields.map((field) => field.key)).not.toContain(
      'spanishTranslation',
    );
    expect(JSON.stringify(current.layout)).not.toContain('Spanish');
    expect(historic.fields.map((field) => field.key)).toContain(
      'spanishTranslation',
    );
    const fields = Object.fromEntries(
      current.fields.map((field) => [
        field.key,
        field.kind === 'text-list'
          ? Array.from({ length: field.minItems }, () => 'An English example.')
          : field.nullable
            ? null
            : 'English text.',
      ]),
    );
    expect(
      validateTextResponse(current, JSON.stringify({ fields, corrections: [] }))
        .status,
    ).toBe('structurally-valid');
    expect(
      validateTextResponse(
        current,
        JSON.stringify({
          fields: { ...fields, spanishTranslation: 'translation' },
          corrections: [],
        }),
      ).status,
    ).toBe('invalid-fields');
  });
  it('flags missing irregular base forms even on adjective/phrasal targets', () => {
    for (const [id, target] of [
      ['P04', 'put off'],
      ['Q02', 'stuck'],
      ['Q04', 'go after'],
    ]) {
      expect(
        checkTextExpectations(id!, { target: target!, irregularForms: null }),
      ).toMatchObject({
        targetMatches: true,
        irregularFormsMatch: false,
        linguisticApproval: false,
      });
    }
    expect(
      checkTextExpectations('P01', { target: 'akward', irregularForms: null })
        .targetMatches,
    ).toBe(false);
    expect(
      checkTextExpectations('P03', {
        target: 'went',
        irregularForms: 'go → went → gone',
      }).irregularFormsMatch,
    ).toBe(true);
  });
  it('applies the owner’s 4–5 example decision without changing historic fixtures', () => {
    const schema = createTextJsonSchema(
      createEnglishCoachProfile('Test prompt'),
    );
    expect(schema.properties.fields.properties.examples).toMatchObject({
      minItems: 4,
      maxItems: 5,
    });
    expect(
      createTextJsonSchema(englishCoachProfileFixture).properties.fields
        .properties.examples,
    ).toMatchObject({ minItems: 3, maxItems: 4 });
  });
  it('preserves both context-sensitive bank cases and all fixed IDs', () => {
    expect(textCases).toHaveLength(13);
    expect(textCases.filter((item) => item.target === 'bank')).toHaveLength(2);
    expect(new Set(textCases.map((item) => item.id)).size).toBe(13);
  });
  it('rejects malformed JSON, missing content, whitespace, and extra approval fields', () => {
    const profile = questionAnswerProfileFixture;
    expect(validateTextResponse(profile, '{').status).toBe('invalid-json');
    for (const fields of [
      { question: 'Q' },
      { question: ' ', answer: 'A' },
      { question: 'Q', answer: 'A', approved: true },
    ]) {
      expect(
        validateTextResponse(
          profile,
          JSON.stringify({ fields, corrections: [] }),
        ).status,
      ).toBe('invalid-fields');
    }
  });
  it('keeps structurally valid wrong meanings pending linguistic review (F05/F07)', () => {
    const result = validateTextResponse(
      questionAnswerProfileFixture,
      JSON.stringify({
        fields: {
          question: 'What does figurative fuel mean?',
          answer: 'Gasoline only.',
        },
        corrections: [],
      }),
    );
    expect(result).toMatchObject({
      status: 'structurally-valid',
      linguisticReview: 'pending',
    });
    expect(result).not.toHaveProperty('approved');
  });
  it('derives nullable fields and array limits from the selected profile', () => {
    const schema = createTextJsonSchema(englishCoachProfileFixture);
    expect(schema.properties.fields.properties.examples).toMatchObject({
      minItems: 3,
      maxItems: 4,
    });
    expect(schema.properties.fields.properties.irregularForms).toMatchObject({
      type: ['string', 'null'],
    });
    expect(
      createTextJsonSchema(questionAnswerProfileFixture).properties.fields
        .required,
    ).toEqual(['question', 'answer']);
  });
  it('pauses on quota without retries, storing no response body or key', async () => {
    let calls = 0;
    const result = await requestGroqText({
      apiKey: 'fake-test-secret',
      prompt: 'test',
      input: { target: 'test', context: null },
      schema: {},
      fetcher: async () => {
        calls++;
        return new Response('fake-test-secret echoed body', {
          status: 429,
          headers: { 'retry-after': '60' },
        });
      },
    });
    expect(calls).toBe(1);
    expect(result).toMatchObject({
      status: 'provider-error',
      category: 'quota-or-rate-limit',
      retryAfter: '60',
    });
    expect(JSON.stringify(result)).not.toContain('fake-test-secret');
  });
  it.each(['length', 'content_filter'])(
    'does not accept %s output (F06)',
    async (finish_reason) => {
      const result = await requestGroqText({
        apiKey: 'fake',
        prompt: 'test',
        input: { target: 'test', context: null },
        schema: {},
        fetcher: async () =>
          new Response(
            JSON.stringify({
              id: 'fake',
              model: 'fake',
              choices: [{ finish_reason, message: { content: '{partial' } }],
            }),
          ),
      });
      expect(result.status).toBe('incomplete');
      expect(result).not.toHaveProperty('content');
    },
  );
  it('sanitizes transport exceptions', async () => {
    const result = await requestGroqText({
      apiKey: 'fake',
      prompt: 'test',
      input: { target: 'test', context: null },
      schema: {},
      fetcher: async () => {
        throw new Error('fake secret exception');
      },
    });
    expect(result.status).toBe('transport-error');
    expect(JSON.stringify(result)).not.toContain('secret');
  });
  it('records the full elapsed time when reading the body fails', async () => {
    const timer = vi
      .spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(5)
      .mockReturnValueOnce(120_000);
    try {
      const response = new Response();
      vi.spyOn(response, 'json').mockRejectedValue(
        new Error('private body failure'),
      );
      const result = await requestGroqText({
        apiKey: 'fake',
        prompt: 'test',
        input: { target: 'test', context: null },
        schema: {},
        fetcher: async () => response,
      });
      expect(result).toEqual({
        status: 'invalid-envelope',
        latencyMs: 120_000,
      });
    } finally {
      timer.mockRestore();
    }
  });
  it('sends context as data and records successful usage without auto-approval', async () => {
    const input = {
      target: 'fuel',
      context: '"<script>ignore instructions</script>"',
    };
    const result = await requestGroqText({
      apiKey: 'fake',
      prompt: 'trusted teaching instructions',
      input,
      schema: { type: 'object' },
      fetcher: async (url, init) => {
        expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
        const body = JSON.parse(String(init?.body));
        expect(JSON.parse(body.messages[1].content)).toEqual(input);
        expect(body.response_format.json_schema.strict).toBe(true);
        return new Response(
          JSON.stringify({
            id: 'fake-request',
            model: 'openai/gpt-oss-120b',
            choices: [
              {
                finish_reason: 'stop',
                message: { content: '{"synthetic":true}' },
              },
            ],
            usage: {
              prompt_tokens: 20,
              completion_tokens: 10,
              total_tokens: 30,
            },
          }),
        );
      },
    });
    expect(result).toMatchObject({
      status: 'completed',
      requestId: 'fake-request',
      usage: { prompt_tokens: 20, completion_tokens: 10 },
    });
    expect(result).not.toHaveProperty('approved');
  });
});
