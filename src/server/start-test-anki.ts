import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

// Only opens the existing disposable collection. Never closes Anki or creates a new profile.
try {
  if (process.platform !== 'win32')
    throw new Error('This test launcher requires Windows.');
  const directory = resolve('.tools/anki-av004');
  const executable =
    process.env.ANKI_EXECUTABLE ??
    join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Anki', 'Anki.exe');
  try {
    await access(executable);
    await access(join(directory, 'addons21', '2055492159', '__init__.py'));
    await access(join(directory, 'User 1', 'collection.anki2'));
  } catch {
    throw new Error(
      'The Anki executable or existing isolated test collection/add-on is missing. See README setup instructions.',
    );
  }
  const processes = await promisify(execFile)(
    'tasklist.exe',
    ['/FI', 'IMAGENAME eq anki.exe', '/FO', 'CSV', '/NH'],
    { windowsHide: true, timeout: 5000, maxBuffer: 65536 },
  );
  if (/^"anki\.exe",/im.test(processes.stdout))
    throw new Error(
      'Anki is already running. Close it normally first, then run npm run anki:test again.',
    );
  const child = spawn(
    executable,
    ['-b', directory, '-l', 'en', '-p', 'User 1'],
    { detached: true, stdio: 'ignore', windowsHide: false },
  );
  await new Promise<void>((resolveLaunch, reject) => {
    child.once('spawn', resolveLaunch);
    child.once('error', () =>
      reject(new Error('Could not start the isolated Anki collection.')),
    );
  });
  child.unref();
  console.log(
    'Opened the isolated Anki test collection (User 1). In the web app, refresh the Anki connection.',
  );
} catch (error) {
  const message = error instanceof Error ? error.message : '';
  const allowed = [
    'This test launcher requires Windows.',
    'The Anki executable or existing isolated test collection/add-on is missing. See README setup instructions.',
    'Anki is already running. Close it normally first, then run npm run anki:test again.',
    'Could not start the isolated Anki collection.',
  ];
  console.error(
    allowed.includes(message)
      ? message
      : 'Could not check or launch Anki. Close Anki normally and check the test setup.',
  );
  process.exitCode = 1;
}
