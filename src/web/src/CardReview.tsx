import { useState } from 'react';
import type { Workspace } from '../../shared/card-import';
import {
  cardSides,
  cardText,
  coachFieldSchema,
  coachFields,
} from '../../shared/card-display';
import {
  approveCard,
  getWorkspace,
  updateCard,
  WorkspaceConflictError,
} from './api';

type Card = Workspace['cards'][number];

export function CardReview({
  workspace,
  onChange,
}: {
  workspace: Workspace;
  onChange: (next: Workspace) => void;
}) {
  const [index, setIndex] = useState(0);
  const card = workspace.cards[Math.min(index, workspace.cards.length - 1)];
  if (!card)
    return (
      <section aria-labelledby="review-heading">
        <h2 id="review-heading">Review cards</h2>
        <p>Import a card to begin individual review.</p>
      </section>
    );
  return (
    <CardEditor
      key={`${card.id}:${card.revision}`}
      card={card}
      index={index}
      count={workspace.cards.length}
      onNavigate={(next) => setIndex(next)}
      onChange={onChange}
    />
  );
}

function CardEditor({
  card,
  index,
  count,
  onNavigate,
  onChange,
}: {
  card: Card;
  index: number;
  count: number;
  onNavigate: (index: number) => void;
  onChange: (next: Workspace) => void;
}) {
  const [fields, setFields] = useState<Record<string, unknown>>(() =>
    structuredClone(card.fields),
  );
  const [listDrafts, setListDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      coachFields
        .filter((field) => field.kind === 'text-list')
        .map((field) => [
          field.key,
          (card.fields[field.key] as string[]).join('\n'),
        ]),
    ),
  );
  const [included, setIncluded] = useState(card.included);
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const validation = coachFieldSchema.safeParse(fields);
  const dirty =
    JSON.stringify(fields) !== JSON.stringify(card.fields) ||
    coachFields.some(
      (field) =>
        field.kind === 'text-list' &&
        listDrafts[field.key] !==
          (card.fields[field.key] as string[]).join('\n'),
    ) ||
    included !== card.included;
  const edited =
    JSON.stringify(card.fields) !== JSON.stringify(card.originalFields);
  const approved =
    card.approval?.revision === card.revision &&
    card.approval.contentHash === card.contentHash;
  const status = !validation.success
    ? 'Needs attention'
    : !included
      ? 'Excluded'
      : approved && !dirty
        ? 'Approved'
        : edited || dirty
          ? 'Edited'
          : 'Ready';
  const sides = validation.success ? cardSides(validation.data) : null;

  function changeField(
    key: string,
    value: string,
    isList: boolean,
    nullable: boolean,
  ) {
    if (isList) setListDrafts((prior) => ({ ...prior, [key]: value }));
    setFields((prior) => ({
      ...prior,
      [key]: isList
        ? value
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
        : nullable && !value.trim()
          ? null
          : value,
    }));
  }

  async function save() {
    if (!validation.success) return;
    setBusy(true);
    setMessage('');
    setConflict(false);
    try {
      const next = await updateCard(card.id, {
        expectedRevision: card.revision,
        fields: validation.data,
        included,
      });
      onChange(next);
      setListDrafts(
        Object.fromEntries(
          coachFields
            .filter((field) => field.kind === 'text-list')
            .map((field) => [
              field.key,
              (validation.data[field.key] as string[]).join('\n'),
            ]),
        ),
      );
      setMessage('Saved.');
    } catch (error) {
      if (error instanceof WorkspaceConflictError) {
        setConflict(true);
        setMessage(
          'This card changed in another tab. Your unsaved draft is still here. Copy it before refreshing the saved card.',
        );
      } else {
        setMessage('Could not save. Your unsaved edits are still here.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!validation.success || dirty) return;
    try {
      await navigator.clipboard.writeText(cardText(card.fields));
      setMessage('Card text copied.');
    } catch {
      setMessage(
        'Clipboard access failed. Select and copy the preview text instead.',
      );
    }
  }

  async function approve() {
    if (dirty || !validation.success || !included || approved) return;
    setBusy(true);
    setMessage('');
    setConflict(false);
    try {
      onChange(
        await approveCard(card.id, {
          expectedRevision: card.revision,
          expectedContentHash: card.contentHash,
        }),
      );
      setMessage('Approved for this exact revision.');
    } catch (error) {
      if (error instanceof WorkspaceConflictError) {
        setConflict(true);
        setMessage(
          'This card changed in another tab. Refresh the saved card before approving it.',
        );
      } else {
        setMessage('Approval failed. Check the local server and try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function refreshConflictedCard() {
    if (busy) return;
    setBusy(true);
    try {
      onChange(await getWorkspace());
      setConflict(false);
      setMessage(
        'Saved card refreshed. Review the current revision before approving.',
      );
    } catch {
      setMessage('Could not refresh the saved card. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function copyConflictedDraft() {
    if (!validation.success || busy) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify({ fields: validation.data, included }, null, 2),
      );
      setMessage(
        'Unsaved draft copied as JSON. Refresh when you are ready to discard it here.',
      );
    } catch {
      setMessage(
        'Clipboard access failed. Your unsaved draft remains visible.',
      );
    }
  }

  return (
    <section aria-labelledby="review-heading" className="review-section">
      <div className="section-heading">
        <div>
          <p className="step">Card review and approval</p>
          <h2 id="review-heading">Review cards</h2>
        </div>
        <span className="review-status">{status}</span>
      </div>
      <div className="review-navigation">
        <button
          type="button"
          disabled={index === 0 || dirty}
          onClick={() => onNavigate(index - 1)}
        >
          Previous
        </button>
        <span>
          Card {index + 1} of {count}
        </span>
        <button
          type="button"
          disabled={index === count - 1 || dirty}
          onClick={() => onNavigate(index + 1)}
        >
          Next
        </button>
      </div>
      {dirty ? (
        <p role="status">
          Unsaved edits. Save or discard before changing cards.
        </p>
      ) : null}
      <label>
        <input
          type="checkbox"
          disabled={busy}
          checked={included}
          onChange={(event) => setIncluded(event.target.checked)}
        />{' '}
        Include this card
      </label>
      <div className="review-grid">
        <div>
          <h3>Fields</h3>
          {coachFields.map((field) => {
            const value = fields[field.key];
            const text = Array.isArray(value)
              ? (listDrafts[field.key] ?? '')
              : typeof value === 'string'
                ? value
                : '';
            return (
              <label key={field.key}>
                {field.label}
                <textarea
                  disabled={busy}
                  rows={field.kind === 'text-list' ? 5 : 2}
                  value={text}
                  onChange={(event) =>
                    changeField(
                      field.key,
                      event.target.value,
                      field.kind === 'text-list',
                      field.kind === 'text' && field.nullable,
                    )
                  }
                />
                {field.kind === 'text-list' ? (
                  <span>One item per line</span>
                ) : null}
              </label>
            );
          })}
        </div>
        <div>
          <h3>Card preview</h3>
          {sides ? (
            <>
              <article className="card-side">
                <h4>Front</h4>
                <pre>{sides.front}</pre>
              </article>
              <article className="card-side">
                <h4>Back</h4>
                <pre>{sides.back}</pre>
              </article>
            </>
          ) : (
            <p className="issue">
              Fix the fields below to restore the preview.
            </p>
          )}
          {!validation.success ? (
            <ul className="issue">
              {validation.error.issues.map((issue, i) => (
                <li key={i}>
                  {issue.path.join('.')}: {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
          <details>
            <summary>Original imported source</summary>
            <pre>{card.originalText}</pre>
          </details>
        </div>
      </div>
      <div className="review-actions">
        <button
          type="button"
          disabled={!dirty || !validation.success || busy}
          onClick={() => void save()}
        >
          Save changes
        </button>
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={() => {
            setFields(structuredClone(card.fields));
            setListDrafts(
              Object.fromEntries(
                coachFields
                  .filter((field) => field.kind === 'text-list')
                  .map((field) => [
                    field.key,
                    (card.fields[field.key] as string[]).join('\n'),
                  ]),
              ),
            );
            setIncluded(card.included);
            setMessage('Unsaved edits discarded.');
          }}
        >
          Discard edits
        </button>
        <button
          type="button"
          disabled={dirty || !validation.success || busy}
          onClick={() => void copy()}
        >
          Copy card text
        </button>
        <button
          type="button"
          disabled={
            dirty || !validation.success || !included || approved || busy
          }
          onClick={() => void approve()}
        >
          {approved ? 'Approved' : 'Approve this revision'}
        </button>
      </div>
      {message ? <p role="status">{message}</p> : null}
      {conflict ? (
        <div>
          {dirty ? (
            <button
              type="button"
              disabled={busy || !validation.success}
              onClick={() => void copyConflictedDraft()}
            >
              Copy unsaved draft
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void refreshConflictedCard()}
          >
            {dirty
              ? 'Refresh saved card and discard draft'
              : 'Refresh saved card'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
