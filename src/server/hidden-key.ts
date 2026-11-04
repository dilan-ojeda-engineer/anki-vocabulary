import type { Readable, Writable } from 'node:stream';

type TerminalInput = Readable & {
  isTTY?: boolean;
  setRawMode?: (enabled: boolean) => unknown;
};

/** Read locally from an interactive terminal. Never echo or log credential bytes. */
export function readHiddenKey(
  input: TerminalInput = process.stdin,
  output: Writable = process.stdout,
): Promise<string> {
  if (!input.isTTY || !input.setRawMode)
    return Promise.reject(
      new Error('Run this command in an interactive terminal.'),
    );
  return new Promise((resolve, reject) => {
    let key = '';
    const cleanup = () => {
      input.removeListener('data', onData);
      input.removeListener('end', onEnd);
      input.setRawMode?.(false);
      input.pause();
      output.write('\n');
    };
    const fail = (message: string) => {
      key = '';
      cleanup();
      reject(new Error(message));
    };
    const onEnd = () => fail('Key entry ended before completion.');
    const onData = (chunk: Buffer | string) => {
      for (const character of chunk.toString()) {
        if (character === '\u0003') {
          fail('Key entry cancelled.');
          return;
        }
        if (character === '\r' || character === '\n') {
          const value = key.trim();
          if (!/^[A-Za-z0-9_-]{10,512}$/.test(value)) {
            fail('The key format is invalid. Enter the key again locally.');
            return;
          }
          key = '';
          cleanup();
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b')
          key = key.slice(0, -1);
        else if (character === '\u0015') key = '';
        else key += character;
        if (key.length > 512) {
          fail('Key entry is too long.');
          return;
        }
      }
    };
    input.setRawMode?.(true);
    output.write('ElevenLabs API key (hidden; this server session only): ');
    input.on('data', onData);
    input.once('end', onEnd);
    input.resume();
  });
}
