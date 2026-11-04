import { useEffect, useState } from 'react';
import type { SpeechSettings as Settings } from '../../shared/speech-settings';
import {
  getSpeechSettings,
  updateSpeechSettings,
  AudioRequestError,
} from './api';

const issues: Record<NonNullable<Settings['issue']>, string> = {
  'storage-unavailable':
    'Windows encryption is unavailable. Keys cannot be saved on this device.',
  'credential-unreadable':
    'The saved key could not be unlocked. Replace it below or remove it.',
  'account-access-denied':
    'ElevenLabs denied access. Check the key and its account read permissions, or replace the key below.',
  'account-rate-limited':
    'ElevenLabs rate-limited the account check. Wait, then check again.',
  'account-unavailable':
    'The account check failed. Check your connection and key, then check again.',
  'free-allowance-unavailable':
    'Available free allowance could not be confirmed. Generation stays blocked; no paid fallback is used.',
};

export function SpeechSettings({ onChanged }: { onChanged: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void getSpeechSettings()
        .then((value) => {
          if (active) {
            setSettings(value);
            setLoadError(false);
          }
        })
        .catch(() => {
          if (active) setLoadError(true);
        });
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  async function act(action: 'save' | 'check' | 'remove') {
    if (busy) return;
    setBusy(true);
    setMessage('');
    const entered = key;
    if (action === 'save') setKey('');
    try {
      setSettings(
        await updateSpeechSettings(
          action === 'save' ? { action, key: entered } : { action },
        ),
      );
      setMessage(
        action === 'save'
          ? 'Key validated and saved securely. It will be reused after restarts.'
          : action === 'remove'
            ? 'Saved and session credentials removed from this running server. Existing clips are kept.'
            : 'Account check finished.',
      );
      onChanged();
    } catch (error) {
      setMessage(
        error instanceof AudioRequestError
          ? error.message
          : 'Speech settings could not be updated. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="speech-settings-heading">
      <h2 id="speech-settings-heading">Speech settings</h2>
      <p>
        ElevenLabs · Sarah. Paste your key once to save it with Windows
        encryption for this Windows account. Saved keys are kept separately from
        cards and audio.
      </p>
      {settings ? (
        <>
          <p
            role="status"
            className={settings.issue ? 'status error' : 'status'}
          >
            {settings.state === 'ready'
              ? 'Account and free allowance verified.'
              : settings.state === 'checking'
                ? 'Checking your ElevenLabs account…'
                : settings.configured
                  ? 'A key is configured.'
                  : 'No usable key is configured.'}{' '}
            {settings.source === 'saved'
              ? 'Using the encrypted saved key.'
              : settings.source === 'session'
                ? 'Using a temporary session key; save a key below to keep it after restarts.'
                : ''}
            {settings.issue ? ` ${issues[settings.issue]}` : ''}
          </p>
          {settings.allowance ? (
            <p>
              Account report: {settings.allowance.tier} ·{' '}
              {settings.allowance.used} used / {settings.allowance.limit} limit.
              Generation verifies allowance again.
            </p>
          ) : null}
          {!settings.storageAvailable ? (
            <p className="status error">
              Windows encryption is unavailable. No plaintext key will be saved.
            </p>
          ) : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void act('save');
            }}
          >
            <label htmlFor="elevenlabs-key">
              {settings.source === 'saved'
                ? 'Replacement ElevenLabs API key'
                : 'ElevenLabs API key'}
            </label>
            <input
              id="elevenlabs-key"
              className="speech-key-input"
              type="password"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              maxLength={512}
              disabled={busy}
              placeholder="Paste your API key"
            />
            <div className="review-actions">
              <button
                type="submit"
                disabled={busy || !key.trim() || !settings.storageAvailable}
              >
                {busy ? 'Working…' : 'Validate and save key'}
              </button>
              <button
                type="button"
                disabled={busy || !settings.configured}
                onClick={() => void act('check')}
              >
                Check connection and allowance
              </button>
              <button
                type="button"
                disabled={
                  busy ||
                  (!settings.configured &&
                    settings.issue !== 'credential-unreadable')
                }
                onClick={() => void act('remove')}
              >
                Remove key
              </button>
            </div>
          </form>
        </>
      ) : (
        <p>Loading speech settings…</p>
      )}
      {message ? (
        <p role="alert" className="status">
          {message}
        </p>
      ) : null}
      {loadError ? (
        <p className="status error" role="alert">
          Speech settings could not be loaded. Check that the local server is
          running with the latest code.
        </p>
      ) : null}
    </section>
  );
}
