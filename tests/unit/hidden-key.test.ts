import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { readHiddenKey } from '../../src/server/hidden-key';

function terminal() {
  const modes: boolean[] = [];
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    setRawMode: (enabled: boolean) => {
      modes.push(enabled);
    },
  });
  const output = new PassThrough();
  let displayed = '';
  output.on('data', (chunk: Buffer) => {
    displayed += chunk.toString();
  });
  return { input, output, modes, displayed: () => displayed };
}

describe('temporary speech key entry', () => {
  it('reads and edits a key without echoing it and restores terminal mode', async () => {
    const term = terminal();
    const pending = readHiddenKey(term.input, term.output);
    term.input.write('discard-this\u0015fake_secret_12x\u007f3\r');
    expect(await pending).toBe('fake_secret_123');
    expect(term.displayed()).not.toContain('fake_secret');
    expect(term.displayed()).not.toContain('discard-this');
    expect(term.modes).toEqual([true, false]);
    expect(term.input.listenerCount('data')).toBe(0);
    expect(term.input.listenerCount('end')).toBe(0);
  });

  it('cancels without exposing entered bytes and restores terminal mode', async () => {
    const term = terminal();
    const pending = readHiddenKey(term.input, term.output);
    term.input.write('fake_secret_123\u0003');
    await expect(pending).rejects.toThrow('Key entry cancelled.');
    expect(term.displayed()).not.toContain('fake_secret');
    expect(term.modes).toEqual([true, false]);
  });

  it('rejects redirected input before reading credentials', async () => {
    const input = new PassThrough();
    await expect(readHiddenKey(input, new PassThrough())).rejects.toThrow(
      'interactive terminal',
    );
    expect(input.listenerCount('data')).toBe(0);
  });
});
