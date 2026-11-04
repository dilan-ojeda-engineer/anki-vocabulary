import { CredentialStore } from './credential-store';
import {
  createInitialSpeechProvider,
  readElevenLabsAllowance,
  SpeechAllowanceError,
} from './elevenlabs';
import type { AudioAllowance } from './audio-service';
import {
  speechKeySchema,
  speechSettingsSchema,
} from '../shared/speech-settings';
import type {
  SpeechSettings,
  SpeechSettingsRequest,
} from '../shared/speech-settings';

export class SpeechSettingsError extends Error {
  constructor(
    readonly code:
      | 'credential-validation-failed'
      | 'credential-storage-failed'
      | 'invalid-credential',
  ) {
    super(code);
  }
}

export class SpeechSettingsService {
  private key: string | null = null;
  private source: SpeechSettings['source'] = null;
  private state: SpeechSettings['state'] = 'missing';
  private issue: SpeechSettings['issue'] = null;
  private allowance: AudioAllowance | null = null;
  private checkedAt: string | null = null;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly store: CredentialStore,
    private readonly checkKey: (
      key: string,
    ) => Promise<AudioAllowance> = readElevenLabsAllowance,
  ) {}

  async initialize(sessionKey?: string): Promise<void> {
    let savedChoice: boolean;
    try {
      const stored = await this.store.load();
      this.key = stored.key;
      savedChoice = stored.present;
      this.source = this.key ? 'saved' : null;
    } catch {
      this.issue = 'credential-unreadable';
      this.state = 'blocked';
      return;
    }
    // Existing environment credentials remain temporary and are never silently persisted.
    if (!this.key && sessionKey && !savedChoice) {
      const parsed = speechKeySchema.safeParse(sessionKey);
      if (parsed.success) {
        this.key = parsed.data;
        this.source = 'session';
      } else {
        this.issue = 'account-access-denied';
        this.state = 'blocked';
        return;
      }
    }
    this.state = this.key ? 'unchecked' : 'missing';
  }
  provider() {
    return this.key ? createInitialSpeechProvider(this.key) : null;
  }
  status(): SpeechSettings {
    return speechSettingsSchema.parse({
      configured: !!this.key,
      source: this.source,
      storageAvailable: this.store.available,
      state: this.state,
      issue: this.issue,
      checkedAt: this.checkedAt,
      allowance: this.allowance
        ? {
            tier: this.allowance.tier,
            used: this.allowance.used,
            limit: this.allowance.limit,
          }
        : null,
    });
  }
  private record(result: AudioAllowance) {
    this.allowance = result;
    this.checkedAt = new Date().toISOString();
    const free =
      result.tier === 'free' && !result.canExtend && result.used < result.limit;
    this.state = free ? 'ready' : 'blocked';
    this.issue = free ? null : 'free-allowance-unavailable';
  }
  private failure(error: unknown) {
    this.checkedAt = new Date().toISOString();
    this.allowance = null;
    this.state = 'blocked';
    this.issue =
      error instanceof SpeechAllowanceError &&
      error.code === 'speech-account-access-denied'
        ? 'account-access-denied'
        : error instanceof SpeechAllowanceError &&
            error.code === 'speech-account-rate-limited'
          ? 'account-rate-limited'
          : 'account-unavailable';
  }
  /** Generation checks current credentials and allowance again, rather than trusting UI status. */
  async readAllowance(): Promise<AudioAllowance> {
    const key = this.key;
    if (!key) throw new Error('Speech provider is not configured.');
    try {
      const result = await this.checkKey(key);
      if (this.key === key) this.record(result);
      return result;
    } catch (error) {
      if (this.key === key) this.failure(error);
      throw error;
    }
  }
  async action(input: SpeechSettingsRequest): Promise<SpeechSettings> {
    return this.withCredentials(async () => {
      if (input.action === 'remove') {
        try {
          await this.store.remove();
        } catch {
          throw new SpeechSettingsError('credential-storage-failed');
        }
        this.key = null;
        this.source = null;
        this.state = 'missing';
        this.issue = null;
        this.allowance = null;
        this.checkedAt = null;
      } else if (input.action === 'save') {
        const parsed = speechKeySchema.safeParse(input.key);
        if (!parsed.success)
          throw new SpeechSettingsError('invalid-credential');
        if (!this.store.available)
          throw new SpeechSettingsError('credential-storage-failed');
        let result: AudioAllowance;
        try {
          result = await this.checkKey(parsed.data);
        } catch {
          throw new SpeechSettingsError('credential-validation-failed');
        }
        try {
          await this.store.save(parsed.data);
        } catch {
          throw new SpeechSettingsError('credential-storage-failed');
        }
        this.key = parsed.data;
        this.source = 'saved';
        this.record(result);
      } else if (this.key) {
        this.state = 'checking';
        try {
          await this.readAllowance();
        } catch {
          /* status contains only a fixed safe issue */
        }
      }
      return this.status();
    });
  }
  /** Key changes wait for in-flight speech commands; an allowance check and its batch use one account. */
  async withCredentials<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.tail.then(operation);
    this.tail = run.catch(() => undefined);
    return run;
  }
}
