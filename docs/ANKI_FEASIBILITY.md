# AV-004 Anki feasibility evidence

Status: owner-authorized for commit and squash merge into local `main`, November 1, 2026. AV-003 was committed as `841dc18`, owner-authorized for squash merge into `main` as `851a2be`, and its completed branch removed. AV-004 was prepared on `feat/AV-004-anki-feasibility`. Board acceptance, independent human peer review, and remote publication remain separate.

## Question and outcome

Can a TypeScript integration discover an existing nested deck, create an app-owned note with local audio, recover a lost receipt without creating a duplicate, and update a studied note without changing identity or scheduling?

**Yes on the tested disposable setup**, with session-bound pairing and the limitations below. The integration used actual Anki for deck discovery, media, insertion, source lookup, native review, and update. Offline tests separately inject transport and validation failures. This is a feasibility adapter/CLI, not the production worker or delivery UI.

| Requirement | Actual result |
| --- | --- |
| List real decks, verify nested destination | Rediscovered `AV004::4e77c223` by name and ID after setup; delivery revalidated it before every send |
| App-owned note and saved audio | One dedicated normal note type, hidden `AvSourceId`, one card, one local mono PCM WAV; upload/readback SHA256 matched |
| Verify playback | Anki accepted native replay; the user confirmed hearing the tone in Anki Browse Preview. Preview was used after the user missed the automated replay |
| Repeat identity without duplication | Repeated same-revision delivery returned `unchanged`; one source match and one create request across the recorded run/resume |
| Lost receipt after insertion | Deliberately threw after `notes.create` returned, before saving its receipt; reloaded intent from JSON and reconciled the existing hidden identity before retry |
| Update a studied note | Actual native Good answer increased repetitions to 1; revision 2 changed content via `notes.update`; note/card/deck IDs and the complete scheduling snapshot remained equal |
| Reject stale collection session | Actual v1 read with a deliberately stale session returned error 1005 / `staleSession` |

The source query and exact field/type checks found one matching note, not a vocabulary-text duplicate. The persisted receipt was then reused for the repeat send and approved update. No delete/recreate, direct collection-database access, AnkiWeb sync, or provider call was performed.

## Tested environment and API decision

- Windows host; Node.js 26.13.0 and npm 11.20.0.
- Installed Anki package metadata: 26.9.3. Runtime `api.describe`: `26.09.3`, `apiMajor: 1`.
- Initially provisioned AnkiConnect SourceHut reference: `c577b44aaadbd72dbc22c823f874a126213fe5c5`. The **captured runtime contract** deep-matched that revision's complete `api-v1.schema.json` and advertised its newer queue/reposition methods as available. Canonical contract SHA256: `5638cd7d844a17e7709d43d9954d2a39799dd5613ea41ccecbd6807ef7eb7546`.
- Source was cloned and its `plugin/` copied only into `.tools/anki-av004/addons21/2055492159`. Anki was launched with `-b C:\projects\anki-vocabulary\.tools\anki-av004 -l en`; its process command line was checked. The user completed first-run setup and opened the isolated `User 1` profile. Personal collection data was not used.
- The isolated add-on listened at `http://127.0.0.1:18765/api/v1`; upstream default authentication remained unset in this test installation. No browser-origin permission or Windows security settings were changed.

The source audit found an important distinction after startup: the **on-disk** add-on matched upstream `760ff48d8bbcfbc956f57c40475a8ab960c36a9c` across all 11 Python files after CRLF/LF normalization. Its Anki package metadata recorded `mod: 1792032779`, branch index 2. The captured runtime contract did not match that older on-disk revision. The initial copy therefore must not be treated as a permanent installation pin. The experiment did not establish when/how the replacement occurred or fingerprint every loaded Python object; it records the runtime contract, provisioning reference, and later disk state separately. Reopening Anki may load different code and requires renewed capability/integration verification. No byte-for-byte installed-source match is claimed.

The current upstream [README](https://git.sr.ht/~foosoft/anki-connect/blob/c577b44aaadbd72dbc22c823f874a126213fe5c5/README.md) recommends JSON-RPC API v1 for new integrations and requires Anki 26.08+. Its [API v1 contract](https://git.sr.ht/~foosoft/anki-connect/blob/c577b44aaadbd72dbc22c823f874a126213fe5c5/API_V1.md) provides explicit session guards and operation handles. Legacy API 6 remains available upstream, but was not the path tested here. Runtime capability discovery confirmed the required methods; these results do not establish support for every Anki or add-on version.

API v1 uses decimal-string IDs. AV-003's shared contracts use safe numeric IDs, so the adapter explicitly rejects out-of-range IDs rather than rounding. `api.describe` does not report the installed source SHA: the revision above comes from provisioning, not API inference. The CLI records an optional `--addon-revision` as an operator declaration, not runtime verification.

The add-on is an external Python dependency, not a Python application backend. Custom project code remains TypeScript. Upstream source, add-on installation, generated WAV, collection, receipts, and raw evidence remain under ignored `.tools/`; no upstream add-on source or real app data is bundled in the repository.

## Implementation and validation

- `src/integrations/anki/client.ts`: loopback-only JSON-RPC transport, no redirects, request-ID/envelope/result validation, sanitized failures, bounded operation polling, and retained operation IDs on uncertainty. There is no automatic retry of mutations.
- `src/integrations/anki/schemas.ts`: runtime schemas for the API records actually consumed, including scheduling and safe ID conversion.
- `src/integrations/anki/reconcile.ts`: exact revision-reference approval check, session/pairing/destination guards, hidden-source lookup, ambiguity rejection, create/update distinction, stable per-item receipts, and no silent deck moves or cross-mode identity reuse.
- `src/experiments/anki-feasibility.ts` and `anki-options.ts`: startup argument validation before I/O, explicit disposable-profile opt-in, serialized CLI runs, local intent/receipt files, controlled loss injection, real native review, before/after comparisons, and a preview helper.

`npm run check` passed types, zero-warning lint, formatting, **43 unit tests** (18 Anki transport/recovery/options checks plus 25 existing tests), and desktop build. The separate experiment bundle also built. An invalid compiled-CLI resume command was rejected before I/O and left no lock. The real read-only probe and recorded run/resume are separate from those fake-transport tests. No fresh dependency installation, hosted-provider, linguistic, mobile, packaged-runtime, desktop E2E rerun, or remote CI validation was done in AV-004.

The installed requesting-code-review skill dispatched a separate read-only reviewer. No Critical/Important issue was found. Two minor CLI issues were fixed: resume UUID validation now precedes lock creation with immediate `try/finally`, and optional revision metadata is validated before any external write. The reviewer rechecked those fixes and reported no remaining code findings. Human review/acceptance remains separate. The reviewer did not run checks or make Anki requests.

The WAV is a one-second 440 Hz diagnostic tone, not TTS. It proves media storage/replay on this setup, not American voice quality or pronunciation. A post-preview read still showed repetition count 1 and the same note/card IDs.

### Run history and gaps

The first mutating invocation through Windows `npm.cmd` did not preserve the profile-name argument as intended and failed the profile guard before any write. Running the compiled probe directly with Node preserved `User 1` correctly.

The first live run completed media readback, receipt-loss recovery, and repeat delivery, then stopped after native navigation: the client expected a view record instead of the contract's `Ack`. That expectation was corrected and regression-tested. The **same intent and note** were resumed; no second create request was sent. Original failure history was retained. This was a resumed proof, not a claim of a pristine uninterrupted run after the correction.

The preview helper later reached its bounded operation wait before completion was observed. A separate read verified that Browse was open with the intended note/card selected, and the user confirmed audio using Preview. A pending operation must be inspected/polled by its retained handle rather than blindly reissued. Windows UI automation could not initialize even after its documented reset, so first-run setup and audible playback relied on the user; native API operations provided the data evidence.

Pairing currently binds an explicit local UUID to the active profile **and session**. AnkiConnect's collection record does not expose a persistent collection UUID. Reopening/switching collections invalidates the binding; the adapter blocks rather than silently trusting the same profile name or numeric IDs. Persistent pairing/re-pairing, cross-mode reconciliation, concurrent production delivery, and independent Anki edits remain AV-015/AV-021 work.

The CLI's approval record is a controlled diagnostic fixture authorized by this experiment. It is not a learner-content approval flow. Durable validation/rejection state, authoritative revision content, approval invalidation, and job enforcement remain AV-010/AV-013. Do not expose this probe to React or use it on a live learner collection.

## Reproducing safely

Use a disposable Anki **base directory**, not merely an unverified profile label. Anki's [startup options](https://docs.ankiweb.net/manual/files#startup-options) document `-b` and `-p`. Install the pinned AnkiConnect source only in that base, keep it on loopback port 18765, and open its disposable profile. Do not point the probe at personal collections or enable sync. No existing profile is automatically selected or switched by the CLI.

From the project root:

```powershell
npm run experiment:anki
# Above: build the probe and perform read-only discovery/capability checks.

# Direct Node invocation avoids Windows npm.cmd quoting of a profile with spaces.
node out/experiments/anki-feasibility.mjs --run --disposable-profile "User 1" --addon-revision c577b44aaadbd72dbc22c823f874a126213fe5c5
```

The mutating command creates a **new controlled source identity** per run. Evidence and receipt files go to `.tools/av004-evidence/<run UUID>/`. Each send within that run retains the source identity. An exclusive lock prevents parallel CLI runs against this evidence directory; a crash can leave a lock requiring deliberate inspection/cleanup.

`--resume <run UUID> --disposable-profile "User 1"` supports the narrow recorded case: a failed run with an already-reconciled revision-1 receipt, unchanged fixture fields, and the same Anki session. It reuses the source/model/deck, rejects completed or already-updated runs, and does not guess recovery for other phases. `--preview <run UUID> --disposable-profile "User 1"` opens/selects that existing note for a manual Preview/replay check without recording an answer. Do not rerun a pending operation just because the client stopped waiting.

The [sanitized evidence summary](evidence/AV-004-anki-feasibility.json) records the tested IDs, media checksum, request counts, and scheduling snapshots. The raw ignored evidence retains the original failure, intent, final receipt, complete report, and actual stale-session response. Human peer review and owner acceptance remain pending.
