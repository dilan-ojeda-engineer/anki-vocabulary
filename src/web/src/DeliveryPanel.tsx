import { useEffect, useState } from 'react';
import type { Workspace } from '../../shared/card-import';
import type { DeliveryItem, DeliveryPreview } from '../../shared/delivery';
import {
  getDeliveryStatus,
  prepareDelivery,
  sendDelivery,
  DeliveryRequestError,
} from './api';

export function DeliveryPanel({
  workspace,
  deckId,
}: {
  workspace: Workspace;
  deckId: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<DeliveryPreview | null>(null);
  const [previewSignature, setPreviewSignature] = useState('');
  const [receipts, setReceipts] = useState<DeliveryItem[]>([]);
  const [outcome, setOutcome] = useState<DeliveryItem[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const signature = JSON.stringify([
    deckId,
    selected,
    workspace.cards.map((card) => [
      card.id,
      card.revision,
      card.contentHash,
      card.included,
      card.approval,
      card.audioSelection,
    ]),
  ]);
  const visible = signature === previewSignature ? preview : null;
  useEffect(() => {
    let cancelled = false;
    void getDeliveryStatus()
      .then((data) => {
        if (!cancelled) setReceipts(data.items);
      })
      .catch(() => {
        if (!cancelled)
          setMessage('Saved delivery receipts could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function prepare() {
    setBusy(true);
    setMessage('');
    setPreview(null);
    setReviewed(false);
    setOutcome([]);
    try {
      const result = await prepareDelivery({
        deckId,
        cards: workspace.cards
          .filter((card) => selected.includes(card.id))
          .map((card) => ({
            id: card.id,
            revision: card.revision,
            contentHash: card.contentHash,
          })),
      });
      setPreview(result);
      setPreviewSignature(signature);
      setReceipts((await getDeliveryStatus()).items);
    } catch (error) {
      setMessage(
        error instanceof DeliveryRequestError
          ? error.message
          : 'Could not prepare delivery. Check Anki and the saved revisions.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!visible || !reviewed || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await sendDelivery(visible.previewId);
      setOutcome(result.items);
      setPreview(null);
      setReviewed(false);
      setReceipts((await getDeliveryStatus()).items);
      setMessage(
        'Delivery attempt finished. Check each item below; unresolved items require a new preview and reconciliation.',
      );
    } catch (error) {
      setPreview(null);
      setReviewed(false);
      setMessage(
        error instanceof DeliveryRequestError
          ? error.message
          : 'Delivery was interrupted. Refresh saved receipts and prepare again to reconcile before retrying.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function refreshReceipts() {
    setBusy(true);
    try {
      setReceipts((await getDeliveryStatus()).items);
      setMessage(
        'Saved delivery receipts refreshed. Reconnection never sends automatically.',
      );
    } catch {
      setMessage('Saved receipts are unavailable.');
    } finally {
      setBusy(false);
    }
  }
  function items(values: DeliveryItem[]) {
    return (
      <ul>
        {values.map((item) => (
          <li key={item.id}>
            <b>{item.target}</b> · revision {item.revision} · {item.intent} ·{' '}
            {item.state}
            <p>
              {item.reason} {item.noteId ? `Anki note ${item.noteId}.` : ''}{' '}
              {item.audioCount} audio placements.
            </p>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <section aria-labelledby="delivery-heading">
      <h2 id="delivery-heading">Send cards to Anki</h2>
      <p>
        Choose saved cards and an existing normal deck above. Previewing does
        not change Anki. To change a delivered note, use Update existing Anki
        notes above.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setSelected(
            workspace.cards
              .filter((card) => card.included)
              .map((card) => card.id),
          );
          setReviewed(false);
        }}
      >
        Select included cards
      </button>
      <ul>
        {workspace.cards.map((card) => (
          <li key={card.id}>
            <label className="delivery-choice">
              <input
                type="checkbox"
                checked={selected.includes(card.id)}
                disabled={busy}
                onChange={(event) => {
                  setSelected((prior) =>
                    event.target.checked
                      ? [...prior, card.id]
                      : prior.filter((id) => id !== card.id),
                  );
                  setReviewed(false);
                }}
              />
              {String(card.fields.target)} · revision {card.revision}
              {!card.included ? ' · excluded' : ''}
              {!card.approval ? ' · needs approval' : ''}
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={busy || !deckId || !selected.length}
        onClick={() => void prepare()}
      >
        Preview Anki delivery
      </button>
      {visible ? (
        <div
          className="card-side"
          role="region"
          aria-label="Anki delivery preview"
        >
          <h3>Confirm destination and items</h3>
          <p>
            Profile: {visible.profile} · Deck: {visible.deckName} · ID:{' '}
            {visible.deckId}
          </p>
          <p>Note type: {visible.noteType}</p>
          {items(visible.items)}
          <label className="delivery-choice">
            <input
              type="checkbox"
              checked={reviewed}
              disabled={busy}
              onChange={(event) => setReviewed(event.target.checked)}
            />
            I reviewed these cards and listened to their selected audio.
          </label>
          <div className="review-actions">
            <button
              type="button"
              disabled={
                busy ||
                !reviewed ||
                !visible.items.some((item) => item.intent !== 'omit')
              }
              onClick={() => void send()}
            >
              Confirm send to Anki
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setPreview(null);
                setReviewed(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {busy ? (
        <p role="status">
          Working on delivery… Do not resend while this request is pending.
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      {outcome.length ? (
        <div>
          <h3>Last delivery result</h3>
          {items(outcome)}
        </div>
      ) : null}
      <h3>Saved delivery intent and receipts</h3>
      <button
        type="button"
        disabled={busy}
        onClick={() => void refreshReceipts()}
      >
        Refresh delivery receipts
      </button>
      {receipts.length ? items(receipts) : <p>No saved delivery intent yet.</p>}
    </section>
  );
}
