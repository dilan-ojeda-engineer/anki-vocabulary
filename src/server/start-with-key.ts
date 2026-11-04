import { createServer } from 'node:net';
import { readHiddenKey } from './hidden-key';

const port = Number(process.env.LOCAL_WEB_PORT ?? '43110');
const previous = process.env.ELEVENLABS_API_KEY;
try {
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535)
    throw new Error('Invalid local web port.');
  await new Promise<void>((resolve, reject) => {
    const probe = createServer();
    probe.once('error', () =>
      reject(
        new Error(
          `Port ${port} is already in use. Stop the existing local server first.`,
        ),
      ),
    );
    probe.listen(port, '127.0.0.1', () =>
      probe.close((error) =>
        error
          ? reject(new Error('Could not check the local port.'))
          : resolve(),
      ),
    );
  });
  process.env.ELEVENLABS_API_KEY = await readHiddenKey();
  console.log('Starting the local server with temporary speech credentials.');
  await import('./dev');
} catch (error) {
  const message = error instanceof Error ? error.message : '';
  console.error(
    message.startsWith('Port ') ||
      [
        'Invalid local web port.',
        'Run this command in an interactive terminal.',
        'Key entry cancelled.',
        'Key entry ended before completion.',
        'The key format is invalid. Enter the key again locally.',
        'Key entry is too long.',
      ].includes(message)
      ? message
      : 'Could not start the local server. Check the port and project setup.',
  );
  process.exitCode = 1;
} finally {
  if (previous === undefined) delete process.env.ELEVENLABS_API_KEY;
  else process.env.ELEVENLABS_API_KEY = previous;
}
