import { useEffect, useState } from 'react';
import type { AppInfo } from '../../shared/desktop';

export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    window.desktop.getAppInfo().then(
      (result) => {
        if (active) setInfo(result);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return (
    <main>
      <p className="eyebrow">Anki Vocabulary Studio</p>
      <h1>A workspace for words that stay with you.</h1>
      <p className="intro">
        Turn vocabulary in context into reviewed cards with sentence audio.
      </p>
      <section aria-labelledby="foundation-heading">
        <h2 id="foundation-heading">Desktop foundation</h2>
        <p role="status">
          {failed
            ? 'Unable to connect to the desktop application. Restart the app to try again.'
            : info
              ? `Desktop connected · ${info.version}`
              : 'Connecting to the desktop application…'}
        </p>
        <p>
          The application shell is ready for development. Import, card review,
          audio, and Anki delivery will arrive in later tasks.
        </p>
      </section>
      <footer>Your cards will remain yours to review and approve.</footer>
    </main>
  );
}
