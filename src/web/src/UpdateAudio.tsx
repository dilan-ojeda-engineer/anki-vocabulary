import { useEffect, useRef, useState } from 'react';
import type { Workspace } from '../../shared/card-import';
import type { NoteLoaded } from '../../shared/note-update';
import type {
  AudioBatchRequest,
  AudioPreflight,
  AudioReview,
} from '../../shared/audio-generation';
import { planNoteAudio } from '../../shared/note-audio-plan';
import {
  AudioRequestError,
  generateAudio,
  getAudioReview,
  prepareAudio,
} from './api';

export type UpdateAudioState = {
  signature: string;
  missing: number;
  readyIds: string[];
};
export function UpdateAudio({
  card,
  loaded,
  refreshVersion,
  disabled,
  onGenerated,
  onStateChange,
  onBusyChange,
}: {
  card: Workspace['cards'][number];
  loaded: NoteLoaded;
  refreshVersion: number;
  disabled: boolean;
  onGenerated: () => void;
  onStateChange: (state: UpdateAudioState | null) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [review, setReview] = useState<AudioReview | null>(null);
  const [preflight, setPreflight] = useState<AudioPreflight | null>(null);
  const [batch, setBatch] = useState<AudioBatchRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const preflightRef = useRef<HTMLDivElement>(null);
  const signature = JSON.stringify([
    card.id,
    card.revision,
    card.contentHash,
    loaded.loadId,
    refreshVersion,
  ]);
  useEffect(() => {
    let active = true;
    onStateChange(null);
    void getAudioReview(card.id, {
      expectedRevision: card.revision,
      expectedContentHash: card.contentHash,
    })
      .then((result) => {
        if (!active) return;
        setReview(result);
        const rows = planNoteAudio(loaded, result);
        onStateChange({
          signature,
          missing: rows.filter((item) => item.needsAudio).length,
          readyIds: rows
            .filter((item) => item.ready)
            .map((item) => item.placementId),
        });
      })
      .catch(() => {
        if (active)
          setMessage(
            'Audio could not be checked. Reload the card from Anki and try again.',
          );
      });
    return () => {
      active = false;
    };
  }, [
    card.id,
    card.revision,
    card.contentHash,
    loaded,
    refreshVersion,
    signature,
    onStateChange,
  ]);
  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);
  useEffect(() => {
    if (preflight) {
      preflightRef.current?.focus({ preventScroll: true });
      preflightRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [preflight]);
  const rows = review ? planNoteAudio(loaded, review) : [];
  const missing = rows.filter((item) => item.needsAudio);
  async function prepare(
    mode: AudioBatchRequest['mode'],
    placementIds: string[],
  ) {
    setBusy(true);
    setMessage('');
    setPreflight(null);
    try {
      const request = {
        expectedRevision: card.revision,
        expectedContentHash: card.contentHash,
        mode,
        placementIds,
      };
      setPreflight(await prepareAudio(card.id, request));
      setBatch(request);
    } catch (error) {
      setMessage(
        error instanceof AudioRequestError
          ? error.message
          : 'Could not prepare audio. Check Speech settings and try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    if (!batch || !preflight) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await generateAudio(card.id, {
        ...batch,
        preflightId: preflight.id,
      });
      setReview(result);
      setPreflight(null);
      const current = planNoteAudio(loaded, result);
      onStateChange({
        signature,
        missing: current.filter((item) => item.needsAudio).length,
        readyIds: current
          .filter((item) => item.ready)
          .map((item) => item.placementId),
      });
      setMessage(
        'Audio saved locally. Listen to the clips, then choose Review changes. Anki has not changed.',
      );
      onGenerated();
    } catch (error) {
      setMessage(
        error instanceof AudioRequestError
          ? error.message
          : 'Audio generation did not finish. Check the results and try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="update-audio-heading">
      <h3 id="update-audio-heading">2. Prepare audio</h3>
      <p>
        Unchanged clips stay in Anki. Changed sentences with existing audio need
        matching new clips. New audio is saved locally until you confirm the
        Anki update.
      </p>
      {!review ? (
        <p role="status">Checking which clips need updating…</p>
      ) : (
        <>
          <p role="status">
            {missing.length
              ? `${missing.length} changed ${missing.length === 1 ? 'sentence needs' : 'sentences need'} audio.`
              : 'Required audio is ready. You can review your changes.'}
          </p>
          {missing.length ? (
            <button
              type="button"
              disabled={disabled || busy || !review.configuration}
              onClick={() =>
                void prepare(
                  'explicit',
                  missing.map((item) => item.placementId),
                )
              }
            >
              Generate audio for {missing.length} changed{' '}
              {missing.length === 1 ? 'sentence' : 'sentences'}
            </button>
          ) : null}
          {!review.configuration ? (
            <p>
              To generate audio, check{' '}
              <a href="#speech-settings-heading">Speech settings</a>. Saved
              clips can still play.
            </p>
          ) : null}
          <ul className="audio-items">
            {rows.map((item) => (
              <li key={item.placementId}>
                <h4>{item.label}</h4>
                <pre>{item.sourceText}</pre>
                <p>
                  {item.needsAudio
                    ? 'Text changed — generate matching audio.'
                    : item.ready
                      ? 'Audio ready for review.'
                      : item.hasExisting
                        ? 'Keep existing audio — spoken text is unchanged.'
                        : 'No audio in Anki. Adding a clip is optional.'}
                </p>
                {loaded.audio.find(
                  (old) => old.placementId === item.placementId,
                ) ? (
                  <div>
                    <p>Currently in Anki</p>
                    <audio
                      controls
                      preload="none"
                      src={
                        loaded.audio.find(
                          (old) => old.placementId === item.placementId,
                        )!.url
                      }
                      aria-label={`Anki ${item.label} audio`}
                    />
                  </div>
                ) : null}
                {item.ready ? (
                  <div>
                    <p>Ready to include</p>
                    <audio
                      controls
                      preload="none"
                      src={`/api/audio/${item.artifactKey}`}
                      aria-label={`Proposed ${item.label} audio`}
                    />
                  </div>
                ) : null}
                <button
                  type="button"
                  disabled={
                    disabled ||
                    busy ||
                    !review.configuration ||
                    item.status === 'invalid'
                  }
                  onClick={() =>
                    void prepare(
                      item.needsAudio
                        ? 'explicit'
                        : item.hasExisting ||
                            item.ready ||
                            item.retryMode === 'replacement'
                          ? 'replacement'
                          : 'explicit',
                      [item.placementId],
                    )
                  }
                >
                  {item.needsAudio
                    ? 'Generate updated audio'
                    : item.hasExisting || item.ready
                      ? 'Replace audio'
                      : 'Add audio'}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {preflight ? (
        <div
          className="card-side"
          ref={preflightRef}
          tabIndex={-1}
          role="region"
          aria-label="Review audio generation"
        >
          <h4>Review audio generation</h4>
          <p>
            {preflight.voiceName} · {preflight.clipCount}{' '}
            {preflight.clipCount === 1 ? 'clip' : 'clips'} ·{' '}
            {preflight.uncachedCharacters} characters requiring generation.
            {batch?.mode === 'replacement'
              ? 'A fresh clip will be generated.'
              : 'Exact matching cached clips are reused.'}
          </p>
          {batch?.mode === 'replacement' ? (
            <p>
              This requests a fresh rendition and uses provider allowance. The
              old clip is kept.
            </p>
          ) : null}
          <p>
            Provider allowance: {preflight.allowance.used} used /{' '}
            {preflight.allowance.limit} limit.
          </p>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => void generate()}
          >
            Confirm audio generation
          </button>{' '}
          <button
            type="button"
            disabled={busy}
            onClick={() => setPreflight(null)}
          >
            Cancel generation
          </button>
        </div>
      ) : null}
      {busy ? <p role="status">Working on audio…</p> : null}
      {message ? (
        <p role="status" className="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
