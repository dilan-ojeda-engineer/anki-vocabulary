export function isTrustedDocument(
  candidate: string,
  expected: string,
): boolean {
  try {
    const candidateUrl = new URL(candidate);
    const expectedUrl = new URL(expected);
    // Hash changes are local UI state; query strings and other documents are not.
    candidateUrl.hash = '';
    expectedUrl.hash = '';
    return candidateUrl.href === expectedUrl.href;
  } catch {
    return false;
  }
}
