import { describe, expect, it } from 'vitest';
import { isTrustedDocument } from '../../src/main/security';
import { appInfoSchema } from '../../src/shared/desktop';

describe('desktop boundary', () => {
  it('permits only the intended document, allowing local hash state', () => {
    const expected = 'file:///C:/studio/out/renderer/index.html';
    expect(isTrustedDocument(`${expected}#review`, expected)).toBe(true);
    for (const candidate of [
      'file:///C:/studio/other.html',
      `${expected}?injected=1`,
      'https://example.com',
      'invalid',
    ]) {
      expect(isTrustedDocument(candidate, expected)).toBe(false);
    }
  });
  it('rejects same-host documents outside the development entry point', () => {
    expect(
      isTrustedDocument(
        'http://127.0.0.1:5173/other',
        'http://127.0.0.1:5173/',
      ),
    ).toBe(false);
    expect(
      isTrustedDocument('http://127.0.0.1:5174/', 'http://127.0.0.1:5173/'),
    ).toBe(false);
  });
  it('rejects malformed or unexpected data before exposing it to React', () => {
    for (const value of [
      null,
      {},
      { name: 'Other', version: '1' },
      { name: 'Anki Vocabulary Studio', version: '' },
      { name: 'Anki Vocabulary Studio', version: '1', secret: 'unexpected' },
    ]) {
      expect(appInfoSchema.safeParse(value).success).toBe(false);
    }
  });
});
