import { useCallback, useEffect, useState } from 'react';
import type { LocalWebStatus } from '../../shared/local-web';
import { getLocalWebStatus } from './api';

export function App() {
  const [status, setStatus] = useState<LocalWebStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

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

  const anki = status?.anki;
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

      <section className="next" aria-labelledby="next-heading">
        <h2 id="next-heading">Next workspace step</h2>
        <p>
          Card import, individual editing, audio generation, and delivery will
          be added after this read-only connection path is accepted.
        </p>
      </section>
    </main>
  );
}
