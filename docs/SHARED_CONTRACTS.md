# AV-003 shared contracts and fixtures

Status: owner-authorized for commit and merge on November 1, 2026. AV-003 was committed as `841dc18` and squash-merged into local `main` as `851a2be`; the completed task branch was removed after tree verification. Independent human peer review/board acceptance were not claimed by that operation. AV-002's recorded audit, team-onboarding, and remote-enforcement follow-ups remain open; approval does not turn those into completed checks.

## Consumer entry points

Import runtime schemas and their inferred TypeScript types from `src/shared/contracts/index.ts`. These modules use Zod and plain data only: no Electron, Node, database, provider clients, or filesystem access. `src/shared/desktop.ts` remains the existing metadata-only preload bridge. AV-003 does not expose new privileged commands to React.

| Module | Contract |
| --- | --- |
| `common.ts` | Stable IDs, profile references, exact revision references, field-entry references, timestamps, hashes, and primitive provider settings |
| `profile.ts` | Immutable profile snapshots; text/list field constraints; declarative front/back layout and audio selectors; profile-derived field validation |
| `draft.ts` | Original input and selected target/context; corrections; generation metadata; draft envelopes; separate exact-revision approval records; validation errors |
| `commands.ts` | Approve/edit/reject/regenerate command union, typed handler signature, result/error envelopes, and pure revision-conflict comparison |
| `speech.ts` | Exact sentence request, provider/model/voice/version/settings/format, worker-local artifact, and revision-to-artifact association |
| `delivery.ts` | Paired direct destinations, portable package destinations, complete receipts, and ambiguous direct-send receipts |

The authoritative draft reference is `{ sourceNoteId, revision, profile: { id, version } }`. Every approval command/record, speech request/association, and delivery receipt carries that reference. Source identity stays separate from target/context and generated fields; edits increment the revision rather than creating a new source identity. A profile reference identifies an immutable snapshot, not a mutable editor setting. Consumers must never register different definitions under the same ID/version.

## Validation and command usage

```typescript
import {
  approvalCommandSchema,
  checkExpectedRevision,
  createCardDraftSchema,
  generationProfileSchema,
} from '../shared/contracts';

const profile = generationProfileSchema.parse(receivedSnapshot);
const draft = createCardDraftSchema(profile).parse(receivedDraft);
const command = approvalCommandSchema.parse(receivedCommand);
const conflict = checkExpectedRevision(command.expected, draft.ref);
// The future worker must also check validation/rejection state and perform
// approval + job transitions atomically; matching references alone grant nothing.
```

The example's `received*` values stand for untrusted data at a caller's boundary. No command handler is implemented here. `draftEnvelopeSchema` checks metadata and broad field-value types only; it is not sufficient content validation. Use `createCardDraftSchema(snapshot)` before considering a draft structurally valid. `draft.edit` likewise needs profile validation in its future handler. Unknown profile fields, blank required text, wrong types, and invalid list counts fail. Optional omitted/undefined fields are canonicalized to absence. Nullable required fields must still be present, with `null` used for omitted irregular forms.

`generationProfileSchema` rejects duplicate/reserved field keys and inconsistent layout/audio references. Parsed snapshots and their nested definitions/layouts are frozen. Draft validators capture a parsed snapshot rather than a mutable caller object. Use `z.toJSONSchema(createFieldValuesSchema(profile), { io: 'input' })` when deriving a future provider transport schema; still validate returned values locally. Provider-specific JSON Schema capability and schema conversion limitations are AV-005/AV-011 concerns.

Validation errors carry paths and generic messages without copying rejected values. Revision conflicts explicitly distinguish `STALE_REVISION`, `PROFILE_MISMATCH`, and `IDENTITY_MISMATCH`, including expected/current references. An `ok` command reply acknowledges a resulting revision; it does not prove audio or delivery succeeded. Request IDs support future idempotent handling but do not implement deduplication by themselves.

## Profile and fixture boundaries

`src/shared/fixtures/profiles.ts` supplies English Coach and the F07 question/answer profile. English Coach defines the specified heading order, nullable irregular forms, pronunciation group, 3–4 additional examples, 3–6 chunks, 2–4 alternatives, and front/additional-sentence audio selectors. The alternate profile has only `question` and `answer` and disables audio. This proves the generic engine need not require coach headings or audio. These definitions are fixtures, not a production profile registry or custom-profile editor.

`src/shared/fixtures/workflow.ts` supplies P01 input/correction, revision 1 and edited revision 2 of the same source note, separate approval data, generation lineage, four sentence speech requests, synthetic artifacts, paired/nested destinations, and complete/ambiguous/package receipt examples. The package receipt uses a different source identity from the direct example: no cross-mode reconciliation is claimed.

The operational prompt text is explicitly synthetic and versioned `fixture-1`; the original teaching prompt remains unchanged in [CARD_SPEC.md](CARD_SPEC.md#original-user-prompt). The fixture generation hash fingerprints that synthetic prompt. No text provider/model has been selected through this task. Linguistic content has not received human sign-off. Fake speech artifacts have sentinel hashes and nonexistent paths; receipt IDs, external Anki IDs, GUIDs, and the collection pairing are fake. No audio, Anki note, or package was actually created by these fixtures.

## Responsibilities deferred to their assigned tasks

- AV-009: parsing/import preview, target selection, batch limits, and duplicate review.
- AV-010/AV-013: persistence, immutable-version registration, revision creation, approval invalidation, rejection state, atomic transitions, durable jobs, and deduplication. A pure reference comparison is not worker enforcement.
- AV-005/AV-011: production prompt/schema selection, provider output validation/orchestration, conditional irregular-verb/content checks, and linguistic evaluation. Structural JSON validity is not teaching quality.
- AV-014: authorize speech against current approval; resolve selected text/list entries against the approved profile and fields; compute exact cache keys; create/check files. This task defines the request/artifact shapes only.
- AV-004/AV-015/AV-018: collection revalidation, media completion, source reconciliation, mode restrictions, destination checks, identity persistence, Anki operations, and package export. An ambiguous receipt is not permission to retry creation.

Internal audio records contain `localPath` for the worker; do not expose raw paths as renderer commands. Future previews should use artifact IDs through a restricted service. Provider settings are generation options, never a credentials store: credentials remain outside these records and are supplied only inside the future adapter. Raw SDK responses and clients are not transport values.

## Validation evidence

Observed locally on November 1, 2026 with Node.js 26.13.0 and npm 11.20.0:

- `npm run check` passed: strict desktop/renderer/test typechecks, lint with zero warnings, formatting, 25 unit tests (22 contract tests plus the three existing boundary tests), and production build.
- The first `npm run test:e2e` run had a built-mode timeout at the unchanged 30-second limit while waiting for `electron.launch`; its trace contained no application assertion before the timeout. Development mode passed. Desktop source/configuration/tests were unchanged by AV-003.
- One unchanged `npm exec -- playwright test` rerun with launch diagnostics passed both modes (built 2.7 seconds; development 954 milliseconds). This confirms a successful rerun, not the cause of the first timeout. Keep startup reliability as a follow-up; no timeout/retry settings were relaxed.
- The installed requesting-code-review skill dispatched a separate read-only reviewer for the full uncommitted AV-003 implementation against `c1ed60e`. No actionable Critical, Important, or Minor findings were confirmed. The reviewer did not rerun checks; the execution results above are separate evidence.
- Relative documentation file links and diff whitespace passed. The archived prompt, package manifest, lockfile, preload bridge, and desktop implementation were unchanged. No dependencies were installed or provider calls made for AV-003.

All AV-003 fixtures and tests are offline; they do not validate real providers, Anki compatibility, audio quality, or database recovery. Consumers can use these shapes now, while human review and integration evidence remain separate acceptance work. The initial review-ready result did not authorize a commit or merge; the owner subsequently authorized the local operations recorded above. No publication, proposed human assignment acceptance, or remote-board update occurred.
