import type { FieldValues } from '../shared/contracts';
import { textCases } from './text-cases';

/** Narrow checks against the draft evaluation expectations, not linguistic approval. */
export function checkTextExpectations(id: string, fields: FieldValues) {
  const input = textCases.find((item) => item.id === id);
  if (!input) throw new Error('Unknown evaluation case.');
  const irregular: Readonly<Record<string, string>> = {
    P03: 'go → went → gone',
    P04: 'put → put → put',
    Q01: 'bring → brought → brought',
    Q02: 'stick → stuck → stuck',
    Q04: 'go → went → gone',
  };
  return {
    referenceStatus: 'draft-expectations-human-review-pending' as const,
    targetMatches: fields.target === (id === 'P01' ? 'awkward' : input.target),
    irregularFormsMatch: fields.irregularForms === (irregular[id] ?? null),
    // All other learning criteria require separate reading/reference checks.
    linguisticApproval: false as const,
  };
}
