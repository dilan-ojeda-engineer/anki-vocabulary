import { useEffect, useState } from 'react';
import type { AudioPlan } from '../../shared/audio-plan';
import type { Workspace } from '../../shared/card-import';
import {
  getAudioPlan,
  getWorkspace,
  selectAudio,
  WorkspaceConflictError,
} from './api';

type Card = Workspace['cards'][number];

export function AudioSelection({
  card,
  onChange,
}: {
  card: Card;
  onChange: (workspace: Workspace) => void;
}) {
  const [plan, setPlan] = useState<AudioPlan | null>(null);
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getAudioPlan(card.id, {
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
  }, [card.id, card.revision, card.contentHash]);

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
        Choose the target and sentences to prepare for audio. Generation and
        playback arrive in AV-033.
      </p>
      {plan ? (
        <>
          <div className="review-actions">
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
          <ul className="audio-items">
            {plan.items.map((item) => (
              <li key={item.placementId}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.has(item.placementId)}
                    disabled={
                      busy ||
                      item.status === 'current' ||
                      item.status === 'invalid'
                    }
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
                  {item.side} · {item.characterCount} characters · {item.status}
                </p>
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
      {message ? <p role="alert">{message}</p> : null}
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
