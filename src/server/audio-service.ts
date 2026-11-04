import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import {
  AudioCache,
  AudioIntegrityError,
  audioCacheKey,
  SpeechFailure,
} from './audio-cache';
import type { SpeechProvider } from './audio-cache';
import type { WorkspaceStore } from './workspace';
import { requireApprovedCard } from './workspace';
import { extractAudioItems } from '../shared/audio-plan';
import type {
  AudioBatchRequest,
  AudioGenerateRequest,
  AudioReview,
  AudioPreflight,
} from '../shared/audio-generation';
import { audioReviewSchema } from '../shared/audio-generation';
import type { Workspace } from '../shared/card-import';
import { speechConfigurationSchema } from '../shared/contracts/speech';

const recordSchema = z.strictObject({
  cardId: z.uuid(),
  revision: z.number().int().positive(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  placementId: z.string(),
  requestKey: z.string().regex(/^[a-f0-9]{64}$/),
  artifactKey: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  text: z.string().min(1),
  configuration: speechConfigurationSchema,
  state: z.enum(['complete', 'failed', 'paused']),
  error: z.string().nullable(),
});
const manifestSchema = z.strictObject({
  version: z.literal(1),
  records: z.array(recordSchema),
});
type Manifest = z.infer<typeof manifestSchema>;
export type AudioAllowance = {
  tier: string;
  used: number;
  limit: number;
  canExtend: boolean;
};

export class AudioService {
  private readonly cache: AudioCache;
  private readonly preflights = new Map<
    string,
    { signature: string; expires: number; consumed: boolean }
  >();
  constructor(
    private readonly directory: string,
    private readonly workspace: WorkspaceStore,
    private readonly providerSource:
      SpeechProvider | null | (() => SpeechProvider | null),
    private readonly readAllowance: () => Promise<AudioAllowance>,
    private readonly voiceName = 'Sarah',
  ) {
    this.cache = new AudioCache(join(directory, 'artifacts'));
  }

  private get provider(): SpeechProvider | null {
    return typeof this.providerSource === 'function'
      ? this.providerSource()
      : this.providerSource;
  }

  async review(
    id: string,
    revision: number,
    hash: string,
  ): Promise<AudioReview> {
    return this.workspace.withApprovedCard(id, revision, hash, (card) =>
      this.reviewCard(card),
    );
  }

  async prepare(id: string, input: AudioBatchRequest): Promise<AudioPreflight> {
    return this.workspace.withApprovedCard(
      id,
      input.expectedRevision,
      input.expectedContentHash,
      async (card) => {
        if (!this.provider)
          throw new Error('Speech provider is not configured.');
        const items = await this.chosen(card, input);
        const allowance = await this.readAllowance();
        const characters = items.reduce(
          (sum, item) => sum + item.characterCount,
          0,
        );
        const uncachedRequests = await this.uncachedRequests(items);
        const uncachedCharacters = uncachedRequests.reduce(
          (sum, item) => sum + item.characterCount,
          0,
        );
        this.checkAllowance(allowance, uncachedCharacters);
        for (const [key, value] of this.preflights)
          if (value.expires < Date.now()) this.preflights.delete(key);
        if (this.preflights.size >= 100)
          throw new Error('Too many pending audio batches.');
        const preflightId = randomUUID();
        this.preflights.set(preflightId, {
          signature: this.signature(id, input),
          expires: Date.now() + 300_000,
          consumed: false,
        });
        return {
          id: preflightId,
          clipCount: items.length,
          characterCount: characters,
          uncachedCharacters,
          uncachedRequests,
          allowance: {
            tier: allowance.tier,
            used: allowance.used,
            limit: allowance.limit,
          },
          configuration: this.provider.configuration,
          voiceName: this.voiceName,
        };
      },
    );
  }

  async generate(
    id: string,
    input: AudioGenerateRequest,
  ): Promise<AudioReview> {
    return this.workspace.withApprovedCard(
      id,
      input.expectedRevision,
      input.expectedContentHash,
      async (card) => {
        if (!this.provider)
          throw new Error('Speech provider is not configured.');
        const preflight = this.preflights.get(input.preflightId);
        if (
          !preflight ||
          preflight.signature !== this.signature(id, input) ||
          preflight.expires < Date.now()
        )
          throw new Error('Audio preview expired. Prepare the batch again.');
        if (preflight.consumed) return this.reviewCard(card);
        const items = await this.chosen(card, input);
        const allowance = await this.readAllowance();
        this.checkAllowance(allowance, await this.uncachedCharacters(items));
        preflight.consumed = true;
        const manifest = await this.readManifest();
        let paused = false;
        for (const item of items) {
          const requestKey = audioCacheKey(
            item.text,
            this.provider.configuration,
          );
          const record: z.infer<typeof recordSchema> = {
            cardId: card.id,
            revision: card.revision,
            contentHash: card.contentHash,
            placementId: item.placementId,
            requestKey,
            text: item.text,
            configuration: this.provider.configuration,
            artifactKey: null,
            state: 'paused',
            error: 'quota-or-configuration',
          };
          if (!paused) {
            try {
              record.artifactKey = (
                await this.cache.generate(item.text, this.provider)
              ).key;
              record.state = 'complete';
              record.error = null;
            } catch (error) {
              record.state = 'failed';
              record.error =
                error instanceof SpeechFailure
                  ? error.kind
                  : 'generation-or-storage';
              paused =
                record.error === 'quota' || record.error === 'configuration';
            }
          }
          manifest.records.push(record);
          await this.writeManifest(manifest);
        }
        return this.reviewCard(card);
      },
    );
  }

  async media(key: string) {
    const manifest = await this.readManifest();
    if (!manifest.records.some((record) => record.artifactKey === key))
      return null;
    return this.cache.read(key);
  }

  /** Used only with a server-loaded card while the workspace approval lock is held. */
  async deliveryAudio(card: Workspace['cards'][number]) {
    requireApprovedCard(card);
    const selected = card.audioSelection?.placementIds ?? [];
    if (!selected.length)
      throw new Error('Select at least one audio placement before delivery.');
    const review = await this.reviewCard(card);
    const results = [];
    for (const placementId of selected) {
      const item = review.items.find(
        (item) => item.placementId === placementId,
      );
      if (!item || item.audioState !== 'complete' || !item.artifactKey)
        throw new Error('Selected audio is incomplete or stale.');
      const media = await this.cache.read(item.artifactKey);
      if (!media) throw new Error('Selected audio is unavailable.');
      results.push({ placementId, key: item.artifactKey, ...media });
    }
    return results;
  }

  private signature(id: string, input: AudioBatchRequest) {
    return createHash('sha256')
      .update(
        JSON.stringify([
          id,
          input.expectedRevision,
          input.expectedContentHash,
          input.mode,
          [...input.placementIds].sort(),
          this.provider?.configuration,
        ]),
      )
      .digest('hex');
  }

  private checkAllowance(allowance: AudioAllowance, characters: number) {
    if (
      allowance.tier !== 'free' ||
      allowance.canExtend ||
      !Number.isFinite(allowance.used) ||
      !Number.isFinite(allowance.limit) ||
      allowance.limit - allowance.used < characters
    )
      throw new Error('Confirmed free speech allowance is unavailable.');
  }

  private async uncachedCharacters(items: AudioReview['items']) {
    return (await this.uncachedRequests(items)).reduce(
      (sum, item) => sum + item.characterCount,
      0,
    );
  }

  private async uncachedRequests(items: AudioReview['items']) {
    const requests: { key: string; characterCount: number }[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      if (!this.provider) throw new Error('Speech provider is not configured.');
      const key = audioCacheKey(item.text, this.provider.configuration);
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        if (!(await this.cache.read(key)))
          requests.push({ key, characterCount: item.characterCount });
      } catch (error) {
        if (!(error instanceof AudioIntegrityError)) throw error;
        requests.push({ key, characterCount: item.characterCount });
      }
    }
    return requests;
  }

  private async chosen(
    card: Workspace['cards'][number],
    input: AudioBatchRequest,
  ) {
    const review = await this.reviewCard(card);
    if (new Set(input.placementIds).size !== input.placementIds.length)
      throw new Error('Duplicate audio placement.');
    if (input.mode === 'missing')
      return review.items.filter(
        (item) =>
          item.audioState !== 'complete' && item.audioState !== 'invalid',
      );
    const items = input.placementIds.map((id) =>
      review.items.find((item) => item.placementId === id),
    );
    if (
      !items.length ||
      items.some((item) => !item || item.audioState === 'invalid')
    )
      throw new Error('Invalid audio placement.');
    return items.filter((item): item is AudioReview['items'][number] => !!item);
  }

  private async reviewCard(
    card: Workspace['cards'][number],
  ): Promise<AudioReview> {
    const manifest = await this.readManifest();
    const items: AudioReview['items'] = [];
    for (const item of extractAudioItems(card.fields)) {
      const history = manifest.records.filter(
        (record) =>
          record.cardId === card.id && record.placementId === item.placementId,
      );
      const configuration =
        this.provider?.configuration ??
        [...history].reverse().find((record) => !!record.artifactKey)
          ?.configuration;
      const requestKey =
        item.text && configuration
          ? audioCacheKey(item.text, configuration)
          : null;
      const latest = [...history]
        .reverse()
        .find(
          (record) =>
            record.revision === card.revision &&
            record.contentHash === card.contentHash &&
            record.requestKey === requestKey,
        );
      const older = [...history]
        .reverse()
        .find(
          (record) =>
            !!record.artifactKey && record.artifactKey !== latest?.artifactKey,
        );
      let artifactKey = latest?.artifactKey ?? null;
      let audioState: AudioReview['items'][number]['audioState'] =
        item.status === 'invalid'
          ? 'invalid'
          : (latest?.state ?? (older ? 'stale' : 'missing'));
      let error = latest?.error ?? null;
      if (artifactKey) {
        try {
          if (!(await this.cache.read(artifactKey))) throw new Error('missing');
        } catch {
          artifactKey = null;
          audioState = 'failed';
          error = 'artifact-unavailable';
        }
      }
      let previousKey = older?.artifactKey ?? null;
      if (previousKey) {
        try {
          if (!(await this.cache.read(previousKey))) previousKey = null;
        } catch {
          previousKey = null;
        }
      }
      items.push({
        ...item,
        status:
          audioState === 'complete'
            ? 'current'
            : audioState === 'stale'
              ? 'stale'
              : item.status,
        audioState,
        artifactKey,
        previousKey,
        previousText: previousKey ? (older?.text ?? null) : null,
        error,
      });
    }
    return audioReviewSchema.parse({
      cardId: card.id,
      revision: card.revision,
      contentHash: card.contentHash,
      configuration: this.provider?.configuration ?? null,
      voiceName: this.voiceName,
      items,
    });
  }

  private async readManifest(): Promise<Manifest> {
    try {
      return manifestSchema.parse(
        JSON.parse(await readFile(join(this.directory, 'audio.json'), 'utf8')),
      );
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      )
        return { version: 1, records: [] };
      throw error;
    }
  }

  private async writeManifest(manifest: Manifest) {
    await mkdir(this.directory, { recursive: true });
    const temporary = join(this.directory, `${randomUUID()}.tmp`);
    try {
      await writeFile(
        temporary,
        JSON.stringify(manifestSchema.parse(manifest)),
        { flag: 'wx' },
      );
      await rename(temporary, join(this.directory, 'audio.json'));
    } finally {
      await rm(temporary, { force: true });
    }
  }
}
