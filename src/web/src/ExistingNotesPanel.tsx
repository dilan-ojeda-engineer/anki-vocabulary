import { useEffect, useRef, useState } from 'react';
import type { Workspace } from '../../shared/card-import';
import type {
  NoteLoaded,
  NoteUpdatePreview,
  NoteUpdateResult,
} from '../../shared/note-update';
import { cardSides } from '../../shared/card-display';
import { audioPlacementLabel } from '../../shared/note-audio-plan';
import { CardReview } from './CardReview';
import { UpdateAudio } from './UpdateAudio';
import type { UpdateAudioState } from './UpdateAudio';
import {
  listNotes,
  loadNote,
  restoreNoteDraft,
  prepareNoteUpdate,
  sendNoteUpdate,
  getNoteUpdates,
  reconcileNoteUpdate,
  NoteUpdateRequestError,
  selectAudio,
} from './api';

export function ExistingNotesPanel({
  workspace,
  deckId,
  onChange,
  onEditing,
  audioRefreshVersion,
  onAudioChanged,
  onNavigationBlocked,
}: {
  workspace: Workspace;
  deckId: string;
  onChange: (workspace: Workspace) => void;
  onEditing: (editing: boolean) => void;
  audioRefreshVersion: number;
  onAudioChanged: () => void;
  onNavigationBlocked: (blocked: boolean) => void;
}) {
  const [notes, setNotes] = useState<
    { sourceId: string; noteId: string; target: string }[]
  >([]);
  const [loaded, setLoaded] = useState<NoteLoaded | null>(null);
  const [preview, setPreview] = useState<NoteUpdatePreview | null>(null);
  const [preparedSignature, setPreparedSignature] = useState('');
  const [audioState, setAudioState] = useState<UpdateAudioState | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<NoteUpdateResult[]>([]);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const card = workspace.cards.find((item) => item.id === loaded?.sourceId);
  const signatureFor = (current: typeof card) =>
    JSON.stringify([
      deckId,
      loaded?.loadId,
      current?.revision,
      current?.contentHash,
      current?.approval,
      current?.audioSelection,
      audioRefreshVersion,
      dirty,
    ]);
  const signature = signatureFor(card);
  const audioSignature = JSON.stringify([
    card?.id,
    card?.revision,
    card?.contentHash,
    loaded?.loadId,
    audioRefreshVersion,
  ]);
  const audioReady =
    audioState?.signature === audioSignature && audioState.missing === 0;
  const visible = preparedSignature === signature ? preview : null;
  useEffect(() => {
    onNavigationBlocked(busy || audioBusy || dirty);
    return () => onNavigationBlocked(false);
  }, [busy, audioBusy, dirty, onNavigationBlocked]);
  useEffect(() => {
    if (!dirty) return;
    const protectDraft = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protectDraft);
    return () => window.removeEventListener('beforeunload', protectDraft);
  }, [dirty]);
  useEffect(() => {
    const target = message
      ? feedbackRef.current
      : visible
        ? previewRef.current
        : null;
    if (target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
  }, [message, visible]);
  useEffect(() => {
    let active = true;
    void getNoteUpdates()
      .then((result) => {
        if (active) setResults(result.items);
      })
      .catch(() => {
        if (active) setMessage('Saved update receipts could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, []);
  function failure(error: unknown) {
    setMessage(
      error instanceof NoteUpdateRequestError
        ? error.message
        : 'The existing-note request failed. Check Anki and load the note again.',
    );
  }
  async function refreshList() {
    setBusy(true);
    setMessage('');
    try {
      const result = await listNotes(deckId);
      setNotes(result.notes);
      if (!result.notes.length)
        setMessage(
          'No previously delivered supported notes were found in this deck.',
        );
    } catch (error) {
      failure(error);
    } finally {
      setBusy(false);
    }
  }
  async function load(noteId: string) {
    if (busy || audioBusy || dirty) return;
    setBusy(true);
    setMessage('');
    setPreview(null);
    setReviewed(false);
    try {
      setLoaded(await loadNote(deckId, noteId));
      onEditing(true);
    } catch (error) {
      failure(error);
    } finally {
      setBusy(false);
    }
  }
  async function draft() {
    if (!loaded || !card) return;
    setBusy(true);
    setMessage('');
    setPreview(null);
    setReviewed(false);
    try {
      onChange(await restoreNoteDraft(loaded.loadId, card.revision));
      setMessage(
        'Anki text loaded into your draft. Review it, then choose Save and continue in step 1.',
      );
    } catch (error) {
      failure(error);
    } finally {
      setBusy(false);
    }
  }
  async function prepare() {
    if (
      !loaded ||
      !card ||
      !audioReady ||
      !audioState ||
      busy ||
      audioBusy ||
      dirty
    )
      return;
    setBusy(true);
    setMessage('');
    setPreview(null);
    setReviewed(false);
    try {
      const selected = await selectAudio(card.id, {
        expectedRevision: card.revision,
        expectedContentHash: card.contentHash,
        placementIds: audioState.readyIds,
      });
      onChange(selected);
      setPreview(
        await prepareNoteUpdate({
          loadId: loaded.loadId,
          card: {
            id: card.id,
            revision: card.revision,
            contentHash: card.contentHash,
          },
          mode: 'content',
        }),
      );
      setPreparedSignature(
        signatureFor(selected.cards.find((item) => item.id === card.id)),
      );
    } catch (error) {
      failure(error);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!visible || !reviewed) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await sendNoteUpdate(visible.previewId);
      setResults((await getNoteUpdates()).items);
      setMessage(result.reason);
      if (result.state === 'complete') {
        setLoaded(null);
        onEditing(false);
      }
    } catch (error) {
      failure(error);
    } finally {
      setPreview(null);
      setReviewed(false);
      setBusy(false);
    }
  }
  async function reconcile(updateId: string) {
    setBusy(true);
    setMessage('');
    try {
      const result = await reconcileNoteUpdate(updateId);
      setResults((await getNoteUpdates()).items);
      setMessage(result.reason);
    } catch (error) {
      failure(error);
    } finally {
      setBusy(false);
    }
  }
  const baseline = loaded ? cardSides(loaded.fields) : null;
  const feedback = message ? (
    <div className="status" role="alert" tabIndex={-1} ref={feedbackRef}>
      {message}
    </div>
  ) : null;
  return (
    <section aria-labelledby="existing-notes-heading">
      <h2 id="existing-notes-heading">Update existing Anki notes</h2>
      <p>
        Choose a deck above, then load a previously delivered English Coach
        note. Updates keep the existing note and card. Other note types and
        untracked collections require a separate mapping workflow.
      </p>
      <button
        type="button"
        disabled={busy || !deckId}
        onClick={() => void refreshList()}
      >
        Load supported notes from deck
      </button>
      <ul>
        {notes.map((note) => (
          <li key={note.noteId}>
            <button
              type="button"
              disabled={busy || audioBusy || dirty}
              onClick={() => void load(note.noteId)}
            >
              Load {note.target}
            </button>{' '}
            · Anki note {note.noteId}
          </li>
        ))}
      </ul>
      {!loaded || !card ? feedback : null}
      {loaded && card ? (
        <>
          <h3>Loaded: {String(loaded.fields.target)}</h3>
          <ol className="update-steps" aria-label="Card update steps">
            <li>Edit card</li>
            <li>Prepare audio</li>
            <li>Review changes</li>
            <li>Update in Anki</li>
          </ol>
          <p>
            Profile: {loaded.profile} · Deck: {loaded.deckName} · Anki note{' '}
            {loaded.noteId}
          </p>
          <button
            type="button"
            disabled={busy || audioBusy || dirty}
            onClick={() => void load(loaded.noteId)}
          >
            Reload note from Anki
          </button>{' '}
          <button
            type="button"
            disabled={busy || audioBusy || dirty}
            onClick={() => {
              setLoaded(null);
              setPreview(null);
              onEditing(false);
            }}
          >
            Back to pending cards
          </button>
          <details>
            <summary>Current Anki card and audio</summary>
            <h4>Front</h4>
            <pre>{baseline?.front}</pre>
            <h4>Back</h4>
            <pre>{baseline?.back}</pre>
            {loaded.audio.map((item) => (
              <div key={item.placementId}>
                <p>{item.placementId}</p>
                <audio
                  controls
                  preload="none"
                  src={item.url}
                  aria-label={`Anki ${item.placementId} audio`}
                />
              </div>
            ))}
          </details>
          <details>
            <summary>Use the Anki text instead of my saved draft</summary>
            <p>
              The editor uses your locally saved draft. This action replaces its
              saved text with the loaded Anki values. Review and save it before
              continuing.
            </p>
            <button
              type="button"
              disabled={busy || audioBusy || dirty}
              onClick={() => void draft()}
            >
              Use Anki text
            </button>
          </details>
          <fieldset className="update-editor" disabled={busy || audioBusy}>
            <CardReview
              workspace={{ ...workspace, cards: [card] }}
              onChange={onChange}
              audioRefreshVersion={audioRefreshVersion}
              onAudioChanged={onAudioChanged}
              onDirtyChange={setDirty}
              updateMode
            />
          </fieldset>
          {card.approval && !dirty ? (
            <UpdateAudio
              key={`${card.id}:${card.revision}:${loaded.loadId}`}
              card={card}
              loaded={loaded}
              refreshVersion={audioRefreshVersion}
              disabled={busy}
              onGenerated={onAudioChanged}
              onStateChange={setAudioState}
              onBusyChange={setAudioBusy}
            />
          ) : (
            <section>
              <h3>2. Prepare audio</h3>
              <p>Finish editing and choose Save and continue in step 1.</p>
            </section>
          )}
          <h3>3. Review changes</h3>
          <p>
            Compare the text and audio before sending anything to Anki.
            Unchanged clips are kept automatically.
          </p>
          {dirty || !card.approval ? (
            <p role="status">Save and continue in step 1 first.</p>
          ) : !audioState || audioState.signature !== audioSignature ? (
            <p role="status">Checking audio in step 2…</p>
          ) : audioState.missing ? (
            <p role="status">
              Generate audio for {audioState.missing} changed{' '}
              {audioState.missing === 1 ? 'sentence' : 'sentences'} in step 2
              first.
            </p>
          ) : null}
          <div className="review-actions">
            <button
              type="button"
              disabled={
                busy || audioBusy || dirty || !card.approval || !audioReady
              }
              onClick={() => void prepare()}
            >
              Review changes
            </button>
            <button
              type="button"
              disabled={busy || audioBusy || dirty}
              onClick={() => void load(loaded.noteId)}
            >
              Reload Anki snapshot
            </button>
          </div>
          <p>
            Reloading refreshes Anki details and playback links. Your saved
            draft and generated audio stay unchanged.
          </p>
          {feedback}
          {visible ? (
            <div
              className="card-side"
              role="region"
              aria-label="Existing note update preview"
              ref={previewRef}
              tabIndex={-1}
            >
              <h3>Compare your changes</h3>
              <p>
                {visible.profile} · {visible.deckName} · note {visible.noteId} ·
                {visible.changes.length} text{' '}
                {visible.changes.length === 1 ? 'field' : 'fields'} and{' '}
                {visible.audio.length} audio{' '}
                {visible.audio.length === 1 ? 'clip' : 'clips'} change.
              </p>
              {visible.changes.length ? (
                visible.changes.map((change) => (
                  <div key={change.field}>
                    <h4>{change.field}</h4>
                    <p>Current Anki value</p>
                    <pre>{change.before}</pre>
                    <p>Your saved value</p>
                    <pre>{change.after}</pre>
                  </div>
                ))
              ) : (
                <p>No text changes. Any changed audio is shown below.</p>
              )}
              {visible.audio.map((item) => (
                <div key={item.placementId}>
                  <h4>{audioPlacementLabel(item.placementId)}</h4>
                  <p>Current clip</p>
                  {item.currentUrl ? (
                    <audio controls preload="none" src={item.currentUrl} />
                  ) : (
                    <p>No current clip</p>
                  )}
                  <p>Proposed clip</p>
                  {item.proposedUrl ? (
                    <audio controls preload="none" src={item.proposedUrl} />
                  ) : (
                    <p>
                      Audio reference will be removed; the old media file is
                      kept.
                    </p>
                  )}
                </div>
              ))}
              <p>
                Save and close any Anki editor for this note before confirming.
                Avoid studying it while applying the update.
              </p>
              <h3>4. Update in Anki</h3>
              {!visible.changedFields ? (
                <p>Everything already matches Anki. No update is needed.</p>
              ) : null}
              <label className="delivery-choice">
                <input
                  type="checkbox"
                  checked={reviewed}
                  disabled={busy}
                  onChange={(event) => setReviewed(event.target.checked)}
                />
                I reviewed the changes and listened to the changed audio.
              </label>
              <div className="review-actions">
                <button
                  type="button"
                  disabled={busy || !reviewed || !visible.changedFields}
                  onClick={() => void send()}
                >
                  Update in Anki
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setPreview(null);
                    setReviewed(false);
                  }}
                >
                  Cancel update
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      {busy ? <p role="status">Working on the existing note…</p> : null}
      <h3>Saved update results</h3>
      {results.length ? (
        <ul>
          {results.map((result) => (
            <li key={result.updateId}>
              <b>{result.target}</b> · {result.state} · note {result.noteId}
              <p>{result.reason}</p>
              {!['complete', 'not-applied'].includes(result.state) ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void reconcile(result.updateId)}
                >
                  Reconcile update
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>No saved updates yet.</p>
      )}
    </section>
  );
}
