import { expect, it } from 'vitest';
import {
  ElevenLabsProvider,
  readElevenLabsAllowance,
} from '../../src/server/elevenlabs';

const input = {
  apiKey: 'fake-private-key',
  voiceId: 'fixture-voice',
  modelId: 'fixture-model',
};

it('classifies account check failures without exposing provider bodies or transport details', async () => {
  for (const [status, code] of [
    [401, 'speech-account-access-denied'],
    [403, 'speech-account-access-denied'],
    [429, 'speech-account-rate-limited'],
    [503, 'allowance-check-failed'],
  ] as const) {
    await expect(
      readElevenLabsAllowance(
        input.apiKey,
        async () => new Response('private-provider-detail', { status }),
      ),
    ).rejects.toMatchObject({
      code,
      message: 'Speech allowance could not be verified.',
    });
  }
  await expect(
    readElevenLabsAllowance(input.apiKey, async () => {
      throw new Error('private transport detail');
    }),
  ).rejects.toMatchObject({
    code: 'allowance-check-failed',
    message: 'Speech allowance could not be verified.',
  });
  await expect(
    readElevenLabsAllowance(input.apiKey, async () =>
      Response.json({ private: 'detail' }),
    ),
  ).rejects.toMatchObject({ code: 'allowance-check-failed' });
});

it('reads validated allowance through the account endpoint', async () => {
  const result = await readElevenLabsAllowance(
    input.apiKey,
    async (url, options) => {
      expect(String(url)).toBe(
        'https://api.elevenlabs.io/v1/user/subscription',
      );
      expect(options?.redirect).toBe('error');
      return Response.json({
        tier: 'free',
        character_count: 12,
        character_limit: 10000,
        can_extend_character_limit: false,
      });
    },
  );
  expect(result).toEqual({
    tier: 'free',
    used: 12,
    limit: 10000,
    canExtend: false,
  });
});

it('sends exact text and explicit voice settings to the fixed speech endpoint', async () => {
  const fetcher: typeof fetch = async (url, options) => {
    expect(String(url)).toBe(
      'https://api.elevenlabs.io/v1/text-to-speech/fixture-voice?output_format=mp3_44100_128',
    );
    expect(options?.redirect).toBe('error');
    expect(JSON.parse(options?.body as string)).toMatchObject({
      text: "Don't put it off.",
      model_id: 'fixture-model',
      voice_settings: { speed: 1 },
    });
    expect((options?.headers as Record<string, string>)['xi-api-key']).toBe(
      input.apiKey,
    );
    return new Response(new Uint8Array([255, 251, 0, 0]), {
      headers: { 'content-type': 'audio/mpeg' },
    });
  };
  const provider = new ElevenLabsProvider(input, fetcher);
  expect(await provider.synthesize("Don't put it off.")).toEqual(
    Buffer.from([255, 251, 0, 0]),
  );
  expect(JSON.stringify(provider.configuration)).not.toContain(input.apiKey);
});

it('classifies quota and authentication errors without exposing response content', async () => {
  for (const [status, kind] of [
    [429, 'quota'],
    [401, 'configuration'],
    [503, 'temporary'],
  ] as const) {
    const provider = new ElevenLabsProvider(
      input,
      async () => new Response('private-provider-detail', { status }),
    );
    await expect(provider.synthesize('Hello.')).rejects.toMatchObject({
      kind,
      message: `Speech provider failure: ${kind}`,
    });
  }
  const invalid = new ElevenLabsProvider(
    input,
    async () =>
      new Response('{"private":"detail"}', {
        headers: { 'content-type': 'application/json' },
      }),
  );
  await expect(invalid.synthesize('Hello.')).rejects.toMatchObject({
    kind: 'temporary',
  });
  const network = new ElevenLabsProvider(input, async () => {
    throw new Error('private transport detail');
  });
  await expect(network.synthesize('Hello.')).rejects.toMatchObject({
    message: 'Speech provider failure: temporary',
  });
});
