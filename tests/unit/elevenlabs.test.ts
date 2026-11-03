import { expect, it } from 'vitest';
import { ElevenLabsProvider } from '../../src/server/elevenlabs';

const input = {
  apiKey: 'fake-private-key',
  voiceId: 'fixture-voice',
  modelId: 'fixture-model',
};

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
