import { z } from 'zod';
import { SpeechFailure } from './audio-cache';
import type { SpeechProvider } from './audio-cache';
import type { AudioAllowance } from './audio-service';

export async function readElevenLabsAllowance(
  apiKey: string,
): Promise<AudioAllowance> {
  try {
    const response = await fetch(
      'https://api.elevenlabs.io/v1/user/subscription',
      {
        headers: { 'xi-api-key': apiKey },
        redirect: 'error',
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) throw new Error('unavailable');
    const data = z
      .object({
        tier: z.string(),
        character_count: z.number().nonnegative(),
        character_limit: z.number().nonnegative(),
        can_extend_character_limit: z.boolean(),
      })
      .parse(await response.json());
    return {
      tier: data.tier,
      used: data.character_count,
      limit: data.character_limit,
      canExtend: data.can_extend_character_limit,
    };
  } catch {
    throw new Error('Speech allowance could not be verified.');
  }
}

const idSchema = z.string().regex(/^[A-Za-z0-9_-]+$/);
const settingsSchema = z.strictObject({
  stability: z.number().min(0).max(1).default(0.5),
  similarity_boost: z.number().min(0).max(1).default(0.75),
  style: z.number().min(0).max(1).default(0),
  speed: z.number().min(0.7).max(1.2).default(1),
  use_speaker_boost: z.boolean().default(true),
});

/** Initial owner-selected listening configuration (DEC-028). */
export function createInitialSpeechProvider(
  apiKey: string,
): ElevenLabsProvider {
  return new ElevenLabsProvider({
    apiKey,
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
    modelId: 'eleven_multilingual_v2',
  });
}

/** Account credentials remain private to this server adapter. */
export class ElevenLabsProvider implements SpeechProvider {
  readonly configuration: SpeechProvider['configuration'];
  private readonly key: string;
  private readonly voiceSettings: z.infer<typeof settingsSchema>;

  constructor(
    input: {
      apiKey: string;
      voiceId: string;
      modelId: string;
      settings?: Partial<z.infer<typeof settingsSchema>>;
    },
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.key = z.string().trim().min(1).parse(input.apiKey);
    const voiceId = idSchema.parse(input.voiceId);
    const modelId = idSchema.parse(input.modelId);
    this.voiceSettings = Object.freeze(
      settingsSchema.parse(input.settings ?? {}),
    );
    this.configuration = Object.freeze({
      providerId: 'elevenlabs',
      modelId,
      modelVersion: null,
      voiceId,
      voiceVersion: null,
      settings: Object.freeze({
        ...this.voiceSettings,
        outputFormat: 'mp3_44100_128',
      }),
      format: 'mp3',
    });
  }

  async synthesize(text: string): Promise<Uint8Array> {
    if (!text.trim()) throw new SpeechFailure('configuration');
    try {
      const response = await this.fetcher(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.configuration.voiceId}?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': this.key,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: this.configuration.modelId,
            voice_settings: this.voiceSettings,
          }),
          signal: AbortSignal.timeout(45_000),
          redirect: 'error',
        },
      );
      if (!response.ok) {
        await response.body?.cancel();
        throw new SpeechFailure(
          response.status === 429
            ? 'quota'
            : [400, 401, 403, 404, 422].includes(response.status)
              ? 'configuration'
              : 'temporary',
        );
      }
      if (
        !response.headers
          .get('content-type')
          ?.split(';')[0]
          ?.trim()
          .match(/^audio\/(mpeg|mp3)$/) ||
        !response.body
      ) {
        await response.body?.cancel();
        throw new SpeechFailure('temporary');
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 20_000_000) {
            await reader.cancel();
            throw new SpeechFailure('temporary');
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      if (!size) throw new SpeechFailure('temporary');
      return Buffer.concat(chunks);
    } catch (error) {
      // Never propagate provider bodies, request headers, or raw transport errors.
      if (error instanceof SpeechFailure) throw error;
      throw new SpeechFailure('temporary');
    }
  }
}
