import { useEffect, useState } from 'react';
import type {
  AudioReview,
  AudioPreflight,
  AudioBatchRequest,
} from '../../shared/audio-generation';
import type { Workspace } from '../../shared/card-import';
import {
  getAudioReview,
  prepareAudio,
  generateAudio,
  getWorkspace,
  selectAudio,
  WorkspaceConflictError,
  AudioRequestError,
} from './api';

type Card = Workspace['cards'][number];

export function AudioSelection({
  card,
  onChange,
  refreshVersion,
  onGenerated,
}: {
  card: Card;
  onChange: (workspace: Workspace) => void;
  refreshVersion: number;
  onGenerated?: (() => void) | undefined;
}) {
  const [plan, setPlan] = useState<AudioReview | null>(null);
  const [preflight, setPreflight] = useState<AudioPreflight | null>(null);
  const [batch, setBatch] = useState<AudioBatchRequest | null>(null);
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getAudioReview(card.id, {
      expectedRevision: card.revision,
      expectedContentHash: card.contentHash,
    })
      .then((next) => {
        if (!cancelled) setPlan(next);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof WorkspaceConflictError) setConflict(true);
        setMessage(
          'Audio items could not be loaded. Refresh the saved card and try again.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [card.id, card.revision, card.contentHash, refreshVersion]);

  const selected = new Set(card.audioSelection?.placementIds ?? []);
  const selectedItems =
    plan?.items.filter((item) => selected.has(item.placementId)) ?? [];
  const selectedCharacters = selectedItems.reduce(
    (total, item) => total + item.characterCount,
    0,
  );

  async function saveSelection(placementIds: string[]) {
    if (!plan || busy) return;
    setBusy(true);
    setPreflight(null);
    setMessage('');
    setConflict(false);
    try {
      onChange(
        await selectAudio(card.id, {
          expectedRevision: plan.revision,
          expectedContentHash: plan.contentHash,
          placementIds,
        }),
      );
    } catch (error) {
      if (error instanceof WorkspaceConflictError) {
        setConflict(true);
        setMessage(
          'This card changed in another tab. Refresh before selecting audio.',
        );
      } else {
        setMessage('Audio selection could not be saved. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function prepare(
    mode: AudioBatchRequest['mode'],
    placementIds: string[],
  ) {
    if (busy || !plan) return;
    setBusy(true);
    setMessage('');
    setPreflight(null);
    const request = {
      expectedRevision: card.revision,
      expectedContentHash: card.contentHash,
      mode,
      placementIds,
    };
    try {
      setPreflight(await prepareAudio(card.id, request));
      setBatch(request);
    } catch (error) {
      if (error instanceof WorkspaceConflictError) setConflict(true);
      setMessage(
        error instanceof AudioRequestError
          ? error.message
          : 'Could not prepare audio. Check the speech key, free allowance, and current card revision.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (busy || !batch || !preflight) return;
    setBusy(true);
    setMessage('');
    try {
      setPlan(
        await generateAudio(card.id, { ...batch, preflightId: preflight.id }),
      );
      setPreflight(null);
      setMessage(
        'Audio batch finished. Review each result and listen before delivery. Failed or paused items can be retried explicitly.',
      );
      onGenerated?.();
    } catch (error) {
      if (error instanceof WorkspaceConflictError) setConflict(true);
      setMessage(
        error instanceof AudioRequestError
          ? error.message
          : 'Audio request failed. Prepare again to recover completed clips and retry remaining work.',
      );
      setPreflight(null);
    } finally {
      setBusy(false);
    }
  }

  async function refreshCard() {
    setBusy(true);
    try {
      onChange(await getWorkspace());
      setConflict(false);
      setMessage(
        'Saved card refreshed. Review its approval before selecting audio.',
      );
    } catch {
      setMessage('Could not refresh the saved card. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="audio-selection" aria-labelledby="audio-selection-heading">
      <h3 id="audio-selection-heading">Audio items</h3>
      <p>
        Choose audio items, review the batch details, then generate. Listen to
        each clip before delivery.
      </p>
      {message ? (
        <p className="status" role="alert">
          {message}
        </p>
      ) : null}
      {plan ? (
        <>
          <div className="review-actions">
            <button
              type="button"
              disabled={busy || !plan.configuration || !selected.size}
              onClick={() => void prepare('explicit', [...selected])}
            >
              Generate selected
            </button>
            <button
              type="button"
              disabled={busy || !plan.configuration}
              onClick={() => void prepare('missing', [])}
            >
              Generate all missing
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void saveSelection(
                  plan.items
                    .filter((item) => item.status === 'missing')
                    .map((item) => item.placementId),
                )
              }
            >
              Select all missing
            </button>
            <button
              type="button"
              disabled={busy || selected.size === 0}
              onClick={() => void saveSelection([])}
            >
              Clear selection
            </button>
          </div>
          {!plan.configuration ? (
            <div role="status" className="status error">
              <p>
                Speech generation is unavailable because this server session has
                no key. Saved clips can still play.
              </p>
              <details>
                <summary>Restore speech generation</summary>
                <p>
                  Open <a href="#speech-settings-heading">Speech settings</a>,
                  paste your key, and choose Validate and save key. Generation
                  becomes available without restarting the server.
                </p>
              </details>
            </div>
          ) : null}
          {preflight ? (
            <div
              className="card-side"
              role="region"
              aria-label="Audio batch preview"
            >
              <h4>Audio batch preview</h4>
              {batch?.mode === 'replacement' ? (
                <p>
                  This requests a fresh rendition and uses allowance even when a
                  cached clip exists. The previous clip is retained for
                  comparison.
                </p>
              ) : null}
              <p>
                {preflight.configuration.providerId} · {preflight.voiceName} ·{' '}
                {preflight.configuration.modelId} ·{' '}
                {preflight.configuration.format}
              </p>
              <p>
                {preflight.clipCount} clips · {preflight.characterCount}{' '}
                characters
              </p>
              <p>
                {preflight.uncachedCharacters} uncached speech characters; exact
                cached clips will be reused.
              </p>
              <p>
                Provider report: {preflight.allowance.tier} ·{' '}
                {preflight.allowance.used} used / {preflight.allowance.limit}{' '}
                limit. Usage may update after requests.
              </p>
              <button
                type="button"
                disabled={busy || !preflight.clipCount}
                onClick={() => void generate()}
              >
                Confirm generation
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setPreflight(null)}
              >
                Cancel
              </button>
            </div>
          ) : null}
          {busy ? (
            <p role="status">
              Working on audio… Completed clips are saved individually.
            </p>
          ) : null}
          <ul className="audio-items">
            {plan.items.map((item) => (
              <li key={item.placementId}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.has(item.placementId)}
                    disabled={busy || item.status === 'invalid'}
                    onChange={(event) =>
                      void saveSelection(
                        event.target.checked
                          ? [...selected, item.placementId]
                          : [...selected].filter(
                              (id) => id !== item.placementId,
                            ),
                      )
                    }
                  />{' '}
                  {item.fieldKey === 'examples'
                    ? `Additional example ${item.itemIndex! + 1}`
                    : item.fieldKey === 'frontExample'
                      ? 'Front example'
                      : 'Target'}
                </label>
                <pre>{item.sourceText}</pre>
                {item.sourceText !== item.text ? (
                  <>
                    <p>
                      Speech text (display markup and surrounding quotation
                      marks removed):
                    </p>
                    <pre>{item.text || '(empty — edit this card field)'}</pre>
                  </>
                ) : null}
                {item.status === 'invalid' ? (
                  <p>Edit this card field before selecting it for audio.</p>
                ) : null}
                <p>
                  {item.side} · {item.characterCount} characters ·{' '}
                  {item.audioState}
                </p>
                {item.error ? (
                  <p role="status">Audio issue: {item.error}</p>
                ) : null}
                {item.artifactKey ? (
                  <div>
                    <p>Current clip</p>
                    <audio
                      controls
                      preload="none"
                      src={`/api/audio/${item.artifactKey}`}
                      aria-label={`Current ${item.placementId} audio`}
                    />
                  </div>
                ) : null}
                {item.previousKey ? (
                  <div>
                    <p>Previous clip — compare before replacing</p>
                    <pre>{item.previousText}</pre>
                    <audio
                      controls
                      preload="none"
                      src={`/api/audio/${item.previousKey}`}
                      aria-label={`Previous ${item.placementId} audio`}
                    />
                  </div>
                ) : null}
                <button
                  type="button"
                  disabled={
                    busy || !plan.configuration || item.status === 'invalid'
                  }
                  onClick={() =>
                    void prepare(
                      item.audioState === 'complete' ||
                        item.retryMode === 'replacement'
                        ? 'replacement'
                        : 'explicit',
                      [item.placementId],
                    )
                  }
                >
                  {item.audioState === 'complete'
                    ? 'Generate replacement'
                    : item.retryMode === 'replacement'
                      ? 'Retry replacement'
                      : item.audioState === 'failed' ||
                          item.audioState === 'paused'
                        ? 'Retry this item'
                        : 'Generate this item'}
                </button>
              </li>
            ))}
          </ul>
          <p role="status">
            {selectedItems.length} of {plan.items.length} selected ·{' '}
            {selectedCharacters} characters
          </p>
        </>
      ) : !message ? (
        <p>Loading audio items…</p>
      ) : null}
      {conflict ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void refreshCard()}
        >
          Refresh saved card
        </button>
      ) : null}
    </div>
  );
}
