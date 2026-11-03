import { useCallback, useEffect, useRef, useState } from 'react';
import type { LocalWebStatus } from '../../shared/local-web';
import type {
  ImportPreview,
  ImportRequest,
  Workspace,
} from '../../shared/card-import';
import {
  getLocalWebStatus,
  getWorkspace,
  previewCards,
  saveCards,
} from './api';
import { CardReview } from './CardReview';
import { QueueAudio } from './QueueAudio';

const cardTextPlaceholder = `awkward
“I felt awkward asking for help.”
What does this expression mean?
Meaning:
Feeling uncomfortable in a social situation.
Category:
Adjective
Pronunciation tip:
Native English:
/ˈɔkwɚd/ — Stress the first syllable.
For Spanish speakers:
Keep the first syllable stressed; avoid adding a final vowel.
More examples:
- There was an awkward pause.
- I felt awkward at first.
- That was an awkward question.
- The timing felt awkward.
Common collocations/chunks:
- feel awkward
- an awkward silence
- an awkward moment
Common mistake and usage note:
Use awkward for an uncomfortable situation; embarrassed describes how a person may feel.
Natural alternatives:
- uncomfortable
- uneasy
Spanish Translation:
Incómodo en esta situación social.

---

Next card begins here…`;

const importPlaceholders: Record<ImportRequest['format'], string> = {
  paste: cardTextPlaceholder,
  json: `[
  {
    "target": "awkward",
    "frontExample": "I felt awkward asking for help.",
    "meaning": "Feeling uncomfortable in a social situation.",
    "category": "Adjective",
    "irregularForms": null,
    "nativePronunciation": "/ˈɔkwɚd/ — Stress the first syllable.",
    "spanishPronunciation": "Keep the first syllable stressed.",
    "examples": ["There was an awkward pause after the joke.", "I felt awkward joining the conversation late.", "That was an awkward question to answer.", "The timing felt awkward to everyone."],
    "chunks": ["feel awkward", "an awkward silence", "an awkward moment"],
    "usageNote": "Awkward describes an uncomfortable situation; embarrassed describes how someone may feel.",
    "alternatives": ["uncomfortable", "uneasy"],
    "spanishTranslation": "Incómodo en esta situación social."
  }
]`,
  csv: 'target,frontExample,meaning,category,irregularForms,nativePronunciation,spanishPronunciation,examples,chunks,usageNote,alternatives,spanishTranslation\n"awkward","I felt awkward asking for help.",...\nList cells contain JSON arrays with CSV quotes escaped.',
  tsv: 'target<TAB>frontExample<TAB>meaning<TAB>category<TAB>irregularForms<TAB>nativePronunciation<TAB>spanishPronunciation<TAB>examples<TAB>chunks<TAB>usageNote<TAB>alternatives<TAB>spanishTranslation\nList cells contain JSON arrays.',
};

export function App() {
  const [status, setStatus] = useState<LocalWebStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [audioRefreshVersion, setAudioRefreshVersion] = useState(0);
  const [workspaceError, setWorkspaceError] = useState(false);
  const [format, setFormat] = useState<ImportRequest['format']>('paste');
  const [source, setSource] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewInput, setPreviewInput] = useState<ImportRequest | null>(null);
  const fileReadVersion = useRef(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [importError, setImportError] = useState('');
  const [working, setWorking] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setStatus(await getLocalWebStatus());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void getLocalWebStatus()
      .then((nextStatus) => {
        if (!cancelled) setStatus(nextStatus);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getWorkspace()
      .then((data) => {
        if (!cancelled) {
          setWorkspace(data);
          setWorkspaceError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setWorkspaceError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function retryWorkspace() {
    setWorkspaceError(false);
    try {
      setWorkspace(await getWorkspace());
    } catch {
      setWorkspaceError(true);
    }
  }

  async function inspect() {
    setWorking(true);
    setImportError('');
    const input = { format, text: source };
    try {
      const result = await previewCards(input);
      setPreview(result);
      setPreviewInput(input);
      setSelected(
        result.entries
          .filter((entry) => entry.fields && !entry.issues.length)
          .map((entry) => entry.index),
      );
    } catch {
      setImportError(
        'Could not preview this input. Check its format and size.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function save() {
    if (
      !previewInput ||
      previewInput.format !== format ||
      previewInput.text !== source
    )
      return;
    setWorking(true);
    setImportError('');
    try {
      const result = await saveCards(previewInput, selected);
      setWorkspace(result);
      setPreview(null);
      setPreviewInput(null);
      setSource('');
      setSelected([]);
    } catch {
      setImportError(
        'Could not save the selected cards. Review the input and try again.',
      );
    } finally {
      setWorking(false);
    }
  }

  const anki = status?.anki;
  const visiblePreview =
    previewInput?.format === format && previewInput.text === source
      ? preview
      : null;
  return (
    <main>
      <header>
        <p className="eyebrow">Anki Vocabulary Studio</p>
        <h1>Card and audio workspace</h1>
        <p className="intro">
          Connect to Anki, choose a deck, and prepare reviewed cards locally.
        </p>
      </header>

      <section aria-labelledby="connection-heading">
        <div className="section-heading">
          <div>
            <p className="step">Foundation</p>
            <h2 id="connection-heading">Anki connection</h2>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <p role="status" className={failed ? 'status error' : 'status'}>
          {failed
            ? 'The local server returned an invalid response.'
            : loading
              ? 'Checking the local server and Anki…'
              : anki?.status === 'connected'
                ? `Connected to Anki ${anki.ankiVersion} · ${anki.profile}`
                : 'Anki is unavailable. Start Anki with the supported AnkiConnect add-on, then refresh.'}
        </p>

        {anki?.status === 'connected' ? (
          <label>
            Destination deck
            <select defaultValue="" aria-describedby="deck-help">
              <option value="" disabled>
                Select a deck
              </option>
              {anki.decks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.name}
                  {deck.kind === 'filtered' ? ' (filtered)' : ''}
                </option>
              ))}
            </select>
            <span id="deck-help">
              Selection is local only. This foundation performs no Anki writes.
            </span>
          </label>
        ) : null}
      </section>

      <section aria-labelledby="import-heading">
        <p className="step">AV-029</p>
        <h2 id="import-heading">Import cards</h2>
        <p>
          Prepare cards while Anki is closed. Preview each card before saving it
          locally.
        </p>
        <label>
          Input format
          <select
            value={format}
            onChange={(event) => {
              fileReadVersion.current++;
              setFormat(event.target.value as ImportRequest['format']);
              setPreview(null);
            }}
          >
            <option value="paste">
              Official card text (separate cards with ---)
            </option>
            <option value="json">JSON array</option>
            <option value="csv">CSV</option>
            <option value="tsv">TSV</option>
          </select>
        </label>
        <label>
          Card text or file contents
          <textarea
            rows={12}
            value={source}
            onChange={(event) => {
              fileReadVersion.current++;
              setSource(event.target.value);
              setPreview(null);
            }}
            placeholder={importPlaceholders[format]}
          />
        </label>
        <label>
          Or choose a UTF-8 file
          <input
            type="file"
            accept=".txt,.json,.csv,.tsv,text/plain,application/json,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const readVersion = ++fileReadVersion.current;
              if (file.size > 2_000_000) {
                setImportError('File is larger than 2 MB.');
                return;
              }
              const extension = file.name.toLowerCase().split('.').pop();
              setFormat(
                extension === 'json' ||
                  extension === 'csv' ||
                  extension === 'tsv'
                  ? extension
                  : 'paste',
              );
              void file
                .text()
                .then((text) => {
                  if (fileReadVersion.current !== readVersion) return;
                  setSource(text);
                  setPreview(null);
                  setImportError('');
                })
                .catch(() => {
                  if (fileReadVersion.current === readVersion)
                    setImportError('Could not read this file.');
                });
            }}
          />
        </label>
        <button
          type="button"
          disabled={working || !source.trim()}
          onClick={() => void inspect()}
        >
          Preview import
        </button>
        {importError ? (
          <p role="alert" className="status error">
            {importError}
          </p>
        ) : null}
        {workspaceError ? (
          <p role="alert" className="status error">
            Saved workspace could not be loaded. You can still preview cards.
            <button type="button" onClick={() => void retryWorkspace()}>
              Retry loading saved cards
            </button>
          </p>
        ) : null}
        {visiblePreview ? (
          <div aria-label="Import preview">
            <h3>{visiblePreview.entries.length} detected card(s)</h3>
            {visiblePreview.entries.map((entry) => (
              <div className="import-entry" key={entry.index}>
                <label>
                  <input
                    type="checkbox"
                    disabled={!!entry.issues.length}
                    checked={selected.includes(entry.index)}
                    onChange={(event) =>
                      setSelected((prior) =>
                        event.target.checked
                          ? [...prior, entry.index]
                          : prior.filter((value) => value !== entry.index),
                      )
                    }
                  />{' '}
                  Card {entry.index}:{' '}
                  {typeof entry.fields?.target === 'string'
                    ? entry.fields.target
                    : 'Needs attention'}
                </label>
                {entry.issues.map((issue, index) => (
                  <p key={index} className="issue">
                    {issue.path ? `${issue.path}: ` : ''}
                    {issue.message}
                  </p>
                ))}
                <details>
                  <summary>Original source</summary>
                  <pre>{entry.originalText}</pre>
                </details>
              </div>
            ))}
            <button
              type="button"
              disabled={working || !selected.length}
              onClick={() => void save()}
            >
              Save selected cards
            </button>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="saved-heading">
        <h2 id="saved-heading">Saved pending cards</h2>
        <p>
          {workspace
            ? `${workspace.cards.length} card(s) saved locally`
            : workspaceError
              ? 'Saved cards are unavailable.'
              : 'Loading workspace…'}
        </p>
        <ul>
          {workspace?.cards.map((card) => (
            <li key={card.id}>{String(card.fields.target)}</li>
          ))}
        </ul>
      </section>

      {workspace ? (
        <>
          <QueueAudio
            workspace={workspace}
            onUpdated={() => setAudioRefreshVersion((value) => value + 1)}
          />
          <CardReview
            workspace={workspace}
            onChange={setWorkspace}
            audioRefreshVersion={audioRefreshVersion}
          />
        </>
      ) : null}

      <section className="next" aria-labelledby="next-heading">
        <h2 id="next-heading">Next workspace step</h2>
        <p>
          Anki delivery is planned next. Review and listen to your prepared
          audio first.
        </p>
      </section>
    </main>
  );
}
