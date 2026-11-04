import { useRef, useState } from 'react';
import type { Workspace } from '../../shared/card-import';
import type {
  AudioBatchRequest,
  AudioPreflight,
} from '../../shared/audio-generation';
import { prepareAudio, generateAudio, AudioRequestError } from './api';
import { hasBlockingAudioFailure } from '../../shared/audio-generation';

type PreparedCard = {
  id: string;
  target: string;
  request: AudioBatchRequest;
  preview: AudioPreflight;
};

export function QueueAudio({
  workspace,
  onUpdated,
}: {
  workspace: Workspace;
  onUpdated: () => void;
}) {
  const [prepared, setPrepared] = useState<PreparedCard[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const stopRequested = useRef(false);
  const eligible = workspace.cards.filter(
    (card) =>
      card.included &&
      card.approval?.revision === card.revision &&
      card.approval.contentHash === card.contentHash,
  );
  const signature = JSON.stringify(
    workspace.cards.map((card) => [
      card.id,
      card.revision,
      card.contentHash,
      card.included,
      card.approval,
      card.audioSelection,
    ]),
  );
  const [preparedSignature, setPreparedSignature] = useState('');
  const visible = preparedSignature === signature ? prepared : null;
  const uniqueRequests = new Map(
    visible
      ?.flatMap((entry) => entry.preview.uncachedRequests)
      .map((entry) => [entry.key, entry.characterCount]) ?? [],
  );
  const newCharacters = [...uniqueRequests.values()].reduce(
    (sum, count) => sum + count,
    0,
  );

  async function prepare(mode: 'explicit' | 'missing') {
    setBusy(true);
    setMessage('');
    setPrepared(null);
    const snapshotSignature = signature;
    stopRequested.current = false;
    const cards: PreparedCard[] = [];
    try {
      for (const card of eligible) {
        if (stopRequested.current) break;
        const placementIds =
          mode === 'explicit' ? (card.audioSelection?.placementIds ?? []) : [];
        if (mode === 'explicit' && !placementIds.length) continue;
        const request = {
          expectedRevision: card.revision,
          expectedContentHash: card.contentHash,
          placementIds,
          mode,
        };
        const preview = await prepareAudio(card.id, request);
        if (preview.clipCount)
          cards.push({
            id: card.id,
            target: String(card.fields.target),
            request,
            preview,
          });
      }
      const unique = new Map(
        cards
          .flatMap((entry) => entry.preview.uncachedRequests)
          .map((entry) => [entry.key, entry.characterCount]),
      );
      const allowance = cards.at(-1)?.preview.allowance;
      if (
        allowance &&
        [...unique.values()].reduce((sum, count) => sum + count, 0) >
          allowance.limit - allowance.used
      )
        throw new Error(
          'The queue exceeds the reported free allowance. Generate a smaller selection.',
        );
      setPreparedSignature(snapshotSignature);
      setPrepared(cards);
      if (!cards.length)
        setMessage('No eligible audio items in the saved approved cards.');
    } catch (error) {
      setMessage(
        error instanceof AudioRequestError
          ? error.message
          : 'Could not prepare the queue. Check free allowance, speech configuration, and approvals; try a smaller selection if needed.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!visible || busy) return;
    const snapshot = visible;
    setPrepared(null);
    setBusy(true);
    stopRequested.current = false;
    let completed = 0;
    try {
      for (const entry of snapshot) {
        if (stopRequested.current) break;
        setMessage(
          `Generating saved card ${completed + 1} of ${snapshot.length}: ${entry.target}`,
        );
        const result = await generateAudio(entry.id, {
          ...entry.request,
          preflightId: entry.preview.id,
        });
        completed++;
        onUpdated();
        if (hasBlockingAudioFailure(result, entry.request)) {
          setMessage(
            'Queue paused after a quota or configuration error. Completed clips are saved.',
          );
          return;
        }
      }
      setMessage(
        `Processed ${completed} of ${snapshot.length} cards. Completed clips are saved; review failures and listen before delivery.`,
      );
    } catch {
      onUpdated();
      setMessage(
        'Queue stopped after a conflict, expired preview, or request failure. Completed clips remain saved. Prepare again to resume missing items.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="queue-audio-heading">
      <h2 id="queue-audio-heading">Queue audio</h2>
      <p>
        {eligible.length} of {workspace.cards.length} cards have saved included
        approved revisions. Queue generation uses only those saved revisions;
        save and approve any new edits first.
      </p>
      <div className="review-actions">
        <button
          type="button"
          disabled={busy || !eligible.length}
          onClick={() => void prepare('missing')}
        >
          Prepare all missing audio in queue
        </button>
        <button
          type="button"
          disabled={busy || !eligible.length}
          onClick={() => void prepare('explicit')}
        >
          Prepare selected audio in queue
        </button>
      </div>
      {visible?.length ? (
        <div className="card-side">
          <h3>Queue batch preview</h3>
          <p>
            {visible[0]!.preview.configuration.providerId} ·{' '}
            {visible[0]!.preview.voiceName} ·{' '}
            {visible[0]!.preview.configuration.modelId} ·{' '}
            {visible[0]!.preview.configuration.format}
          </p>
          <p>
            {visible.length} cards ·{' '}
            {visible.reduce((sum, entry) => sum + entry.preview.clipCount, 0)}{' '}
            placements ·{' '}
            {visible.reduce(
              (sum, entry) => sum + entry.preview.characterCount,
              0,
            )}{' '}
            characters · {newCharacters} unique uncached characters
          </p>
          <p>
            Provider report: {visible.at(-1)!.preview.allowance.used} used /{' '}
            {visible.at(-1)!.preview.allowance.limit} limit (
            {visible.at(-1)!.preview.allowance.tier}).
          </p>
          <ul>
            {visible.map((entry) => (
              <li key={entry.id}>
                {entry.target}: {entry.preview.clipCount} clips
              </li>
            ))}
          </ul>
          <button type="button" disabled={busy} onClick={() => void generate()}>
            Confirm queue generation
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setPrepared(null)}
          >
            Cancel
          </button>
        </div>
      ) : null}
      {busy ? (
        <button
          type="button"
          onClick={() => {
            stopRequested.current = true;
          }}
        >
          Stop after current card
        </button>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      <p>
        Each card is checked again before generation. Closing the browser stops
        queue orchestration; the current server request may finish. Prepare
        again to recover the remaining items.
      </p>
    </section>
  );
}
