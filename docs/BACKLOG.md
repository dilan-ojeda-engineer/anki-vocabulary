# Initial development backlog

**Version:** 0.2  
**Date:** October 11, 2026  
**Status:** Proposed assignments and ordering. The owner authorized AV-002, AV-003, and AV-004 merges into local `main`; [foundation follow-ups](DEVELOPMENT.md) and [contract evidence](SHARED_CONTRACTS.md) remain recorded. AV-004 Anki feasibility has [real and simulated evidence](ANKI_FEASIBILITY.md); independent human peer review and board acceptance remain separate. Other implementation remains unstarted. No remote board status or proposed human assignment acceptance is implied.

Use this as the baseline for a shared issue board. Dilan, Bulma, and Trunks are confirmed full-stack developers. Owners/reviewers below are proposed initial assignments; confirm them against availability at kickoff. See [DELIVERY_PLAYBOOK.md](DELIVERY_PLAYBOOK.md). Rows are not remote issues or assignments sent to people.

The readiness pass is documented in [PROTOTYPE_PLAN.md](PROTOTYPE_PLAN.md): proposed configuration, open decisions, and AP-01–AP-13 acceptance scenarios. [AI_EVALUATION.md](AI_EVALUATION.md) fixes the five prototype inputs and defines additional learning/response cases. The integrated five-item demo and linguistic review remain pending; task-specific execution evidence is linked above.

Priority `P0` means establish this prerequisite or resolve a critical risk early; `P1` means required for the desktop release; `P2` means future work. It does not mean every P0 item can start simultaneously. `Ready` requires the working-agreement criteria; items below start in Backlog until refined and prerequisites checked.

## Task inventory

| ID | Outcome | Priority / phase | Proposed owner | Reviewer | Dependencies |
|---|---|---|---|---|---|
| AV-001 | Team kickoff, roles, hosting choice, availability, and MVP decisions recorded | P0 / kickoff | Dilan | Bulma + Trunks | Availability/role confirmation and product-owner input |
| AV-002 | Git/app skeleton, reproducible tooling, first CI checks, contributor setup | P0 / foundation | Dilan | Trunks | AV-001 hosting/setup choices; local work may proceed before remote setup |
| AV-003 | Minimal profile/draft/approval/provider/delivery contracts and fixtures | P0 / foundation | Bulma | Dilan + Trunks | Existing specifications; align with AV-002 before code integration |
| AV-004 | Anki deck listing, identity, update, and ambiguous-send recovery experiment | P0 / feasibility | Trunks | Bulma | AV-002, agreed identity contract from AV-003, disposable Anki profile |
| AV-005 | Text-model experiment and reviewed evaluation examples | P0 / feasibility | Bulma | Dilan | AV-003, recorded provider/model choice, own free-tier account |
| AV-006 | ElevenLabs sentence-file experiment and allowance/error evidence | P0 / feasibility | Trunks | Dilan | AV-002, own account/key, selected available voice |
| AV-007 | Piper Windows installation/voice experiment | P0 / feasibility | Dilan | Trunks | AV-002, runtime/voice installation and licensing review |
| AV-008 | Early packaged-Windows/native/WASM/export feasibility | P0 / feasibility | Dilan | Trunks | AV-002; coordinate export fields with AV-003 |
| AV-009 | Paste/file input preview, target/context parsing, duplicate review | P1 / prototype | Dilan | Bulma | AV-003; fake services acceptable |
| AV-010 | Local persistence, draft revisions, profile snapshots, initial migrations | P1 / prototype | Bulma | Trunks | AV-003, storage result from AV-008 |
| AV-011 | Generation adapter, validation, saved drafts, classified errors | P1 / prototype | Bulma | Trunks | AV-005, AV-010 |
| AV-012 | Card preview/edit/reject/approve interface | P1 / prototype | Dilan | Bulma | AV-003; begin with fixtures, integrate AV-011 |
| AV-013 | Approval enforcement, revision invalidation, durable job transitions | P1 / prototype | Bulma | Dilan | AV-010, AV-012 command integration |
| AV-014 | Hosted sentence-audio adapter, exact cache, playback/status | P1 / prototype | Trunks | Bulma | AV-006, AV-013 |
| AV-015 | Existing-deck selector and recoverable direct send | P1 / prototype | Trunks | Dilan | AV-004, AV-010, AV-013; required media from AV-014 |
| AV-016 | Integrated five-word demo and product acceptance | P0 / prototype gate | Dilan | Bulma + Trunks | AV-009 through AV-015 |
| AV-017 | Piper adapter through the shared speech interface | P1 / MVP | Dilan | Trunks | AV-007, AV-013, shared audio/cache contract from AV-014 |
| AV-018 | Package export with stable identities and embedded media | P1 / MVP | Trunks | Bulma | AV-008, AV-010, AV-013, AV-014; integrate AV-017 media |
| AV-019 | Provider/Anki settings, encrypted keys, setup diagnostics | P1 / MVP | Bulma | Trunks | AV-002, AV-003; prototype uses documented controlled configuration |
| AV-020 | Usable 50-item batch UI, progress, failed-item resume | P1 / MVP | Dilan | Bulma | AV-016, AV-017, AV-019; pair with Bulma on processing changes |
| AV-021 | Interrupted processing/delivery, duplicate and scheduling regression checks | P1 / reliability | Bulma | Trunks | AV-016, AV-018, AV-020 |
| AV-022 | Backup/restore, data migrations, media-retention behavior | P1 / reliability | Bulma | Dilan | AV-010, AV-017, AV-018 |
| AV-023 | Release candidate: Windows packaging, setup guide, notices, release evidence | P1 / pilot | Trunks | Dilan | AV-017 through AV-022 |
| AV-024 | Clean-machine and actual mobile pilot, product sign-off | P1 / release gate | Dilan | Bulma + Trunks | AV-023, named pilot user and supported mobile clients |
| AV-025 | Versioned release delivery and support/triage handover | P1 / release | Rotating release coordinator | Other two developers | AV-024 acceptance and release checklist |
| AV-026 | Custom prompts, fields, layout/audio selectors, profile sharing/editor | P2 / future | Bulma | Dilan | Desktop release evidence and separate scoped design |
| AV-027 | Hosted web application, per-user storage/auth/jobs, desktop-data migration | P2 / future | Trunks | Bulma | Desktop release evidence, hosting budget and separate scoped design |

AV-026/027 are roadmap epics, not Ready implementation tickets. Split them into small issues when those phases are planned. Redistribute owners as capacity and skills become known; do not use this table as a workload estimate.

## Initial parallel work

After kickoff, Dilan establishes the development skeleton while Bulma refines shared contracts and evaluation fixtures. Trunks prepares the Anki test environment and experiment plan. Merge the minimum shared contracts before consumers depend on them.

After foundation, Trunks runs AV-004, Bulma runs AV-005, and Dilan runs AV-007. Trunks completes the hosted-speech experiment next and Dilan completes packaging feasibility, or they pair/reassign work if it becomes the bottleneck. Do not start several active tickets per person to make the board look busy.

During the first workflow, Dilan builds the preview against fixtures, Bulma implements saved drafts and approval, and Trunks integrates speech and Anki against the agreed commands. AV-016 is a shared demonstration, with Dilan responsible for assembling the acceptance evidence. Tests and reviews remain part of each feature ticket, not deferred entirely to AV-021.

## Acceptance criteria for the first work

### AV-001 — Kickoff

- Record Dilan, Bulma, and Trunks as the full-stack team; confirm availability, product owner, technical coordinator, and task/reviewer appointments.
- Record repository hosting/visibility and the review/board policy, including any account-plan limitations.
- Record the prototype text provider/model (Groq with GPT-OSS 120B is currently a recommendation, not a confirmed selection), front/back interpretation, audio coverage, local-runtime assumption, and actual mobile clients where known.
- Identify the first Ready items and unresolved decisions with an owner. No invented delivery dates.
- Use the prototype plan's open-item register to record choices without treating provisional defaults as confirmed decisions. This task remains open until the actual team/decision work is performed.

### AV-002 — Foundation

- A fresh checkout on each developer's Windows setup installs the same locked dependencies and starts the skeleton using documented commands.
- Strict TypeScript, formatting/linting, and a build check work; ordinary automated checks need no provider keys.
- Git excludes credentials, personal app data, voice downloads, and generated audio/decks. Example configuration contains placeholders only.
- Remote CI/review rules are configured when hosting is available, or the missing enforcement is explicitly recorded. A local successful command is not evidence that remote CI exists.

### AV-003 — Shared contracts

- Define the minimum profile, vocabulary input, draft revision, approval command, speech request/artifact, destination, and delivery-receipt shapes.
- Fixtures demonstrate English Coach and a small alternate field layout without adding the future custom-profile editor.
- Dilan/Trunks can use the fixtures and typed commands without inventing incompatible fields. Validation errors and stale-revision errors have explicit contracts.
- Separate learning fields from corrections, hidden source identity, provider metadata, approval, and media state. Include immutable profile version and exact draft revision in relevant commands/receipts.

### AV-004 — Anki feasibility

- List actual decks in a disposable profile and verify an existing nested destination.
- Create an app-owned note with saved audio and verify playback. No direct collection-file writes.
- Repeat sending the same source identity without increasing the matching-note count.
- Simulate losing the local receipt after external creation; reconcile before retrying and retain one matching note.
- Update a studied note's content without deleting it, and compare scheduling before/after. Record supported Anki/add-on versions and collection-pairing limitations.

### AV-005 — Text-model feasibility

- Use P01–P05 and the additional learning cases in [AI_EVALUATION.md](AI_EVALUATION.md); preserve their IDs and input/context. Record expectation review separately from model execution.
- Check required fields and array counts automatically; review meaning, examples, translations, and pronunciation separately.
- Save the prompt/profile version, model, validation failures, correction notes, latency, and observed usage. Record quota behavior without enabling paid fallback.
- Decide whether the candidate is suitable, needs prompt changes, or should be replaced. Evidence of a valid JSON response alone is insufficient.
- Attach raw-versus-edited findings, unrun cases, and an actual candidate decision; run controlled response-error fixtures without consuming unnecessary hosted calls.

### AV-006/007 — Speech feasibility

- Each engine produces locally saved sentence audio that plays in Anki; hosted clips do not depend on temporary URLs.
- Identify the actual voice/model/format and listen for acceptable American English. Record Windows setup requirements and applicable notices.
- For hosted speech, demonstrate clear handling of authentication/quota/service errors. For Piper, demonstrate startup, model lookup, and actionable failure reporting on the tested environment.

### AV-008 — Packaging/export feasibility

- Build/run a minimal Windows package with the proposed SQLite native module and sql.js WASM asset.
- Import a sample package with media into a disposable Anki profile, repeat the import, then update a studied note and compare identity/scheduling.
- Record the exporter/runtime versions and limitations. A successful development build alone does not pass this experiment.

### AV-009 — Input preview

- Paste P01–P05 and correctly separate original text, selected target, and context; do not lose the original misspelling.
- Support UTF-8 text and CSV with target/optional context; show invalid rows and let the user correct/exclude them before submitting. Respect the 50-item first-release batch limit.
- Require a target for F01 sentence-only input and flag potential duplicates after correction, while retaining Q06/Q07 as distinct contextual notes.
- Display escaped text and preserve quotation marks/non-ASCII context. Parsing alone makes no provider, speech, or Anki write request.
- Demonstrate the input-preview outcome with fixtures and retain entered items after a failed submission.

### AV-010 — Persistence and revisions

- Save original inputs, immutable profile version/snapshot, draft fields, proposed corrections, and generation metadata, with stable source-note identity.
- Save revisions and approval as separate state; closing/reopening the app reconstructs the exact draft/approval state without regenerating content.
- Apply the initial migration on an empty workspace and verify reads/writes in the packaged runtime proven by AV-008.
- Persist per-item job/media/delivery references without storing provider key values in SQLite or holding write transactions across external requests.
- Use temporary test databases to verify revision and identity behavior; do not touch a learner's live workspace.

### AV-011 — Generation and validation

- Build requests from the archived teaching requirements via a separately versioned operational prompt and the selected profile's schema. Retain target/context and record model/profile/settings.
- Validate response types, required text, array bounds, and conditional sections before making a draft approvable; F04/F06 stay failed/incomplete.
- Store each successful draft independently. Authentication, quota, timeout, refusal, and response-validation failures produce actionable per-item states.
- Bound structural repair/retry and record attempts; never silently change to a paid model/provider or call a structurally valid card linguistically verified.
- Prove orchestration with fake providers and attach representative real-provider evidence from AV-005; no API keys are exposed to the renderer.

### AV-012 — Review and edit interface

- Render complete front/back cards, corrections, validation findings, and distinct draft/approval/audio statuses; preserve the selected profile's required heading order.
- Let the user edit, regenerate one item, reject, or approve selected revisions without acting on unselected drafts.
- Use typed worker commands for approval. Editing the sentence demonstrates AP-04; a stale revision receives a clear conflict rather than silently approving changed content.
- Keep malformed drafts blocked and show failed generation without discarding other cards. Provide keyboard-accessible controls and a readable narrow preview.
- Verify this interaction against fixtures, then integrated generated drafts. Review buttons alone do not establish worker enforcement.

### AV-013 — Approval and durable jobs

- Enforce exact revision/profile approval outside React; invalid, rejected, unapproved, or stale revisions cannot create speech/delivery work.
- Content edits clear approval; sentence changes invalidate relevant audio associations, while exact unchanged clips can be reused after reapproval.
- Separate approval from queued/running/complete/failed/paused job state; persist each state transition and recover interrupted work.
- Repeated commands do not enqueue duplicate jobs. Database transitions remain atomic; external operations use per-item receipts/reconciliation rather than a fictitious cross-system transaction.
- Cover AP-02/03/04/11 with controlled checks and integrate those checks into the five-word workflow.

### AV-014 — Hosted audio and cache

- From an approved English Coach revision, extract only the configured front/additional sentence texts; omit headings, IPA, Spanish guidance, and display markup.
- Save supported local audio files and reference them beside the correct sentences. Front audio is not inadvertently repeated on the back through the template.
- Cache exact text/provider/model/voice/settings/format matches; identical requests reuse clips. Changed text or settings require the appropriate new clip.
- Keep partial successes on failure, classify quota/auth/network errors, and resume only unfinished work. Voice playback/quality is reviewed using the selected real voice.
- Link fake-provider cache/error evidence with real hosted files from AV-006; never assume a timeout consumed no allowance.

### AV-015 — Deck selection and direct send

- Refresh actual decks and show connection status, full selected destination, approved note count, and omissions before sending.
- Revalidate the destination and current paired collection/profile before writing; AP-09 does not insert into a silent default deck.
- Upload required local media, use the app-owned profile note type, and create/update only the exact approved complete revisions.
- Persist source identity, external IDs, and per-item receipts. Prove AP-05/06/07/08: intended counts, repeat-send deduplication, ambiguous completion recovery, and studied-note scheduling preservation.
- Block unsupported profile/mode identity reuse under AP-13. Keep connection keys protected and offer actionable per-item failures rather than blanket success after a partial send.
- Provide real Anki evidence, including installed versions, and distinguish that evidence from simulated connection fixtures.

### AV-016 — Five-word workflow

- Enter five targets/context items and produce reviewable drafts; invalid drafts remain blocked.
- Approve selected revisions, generate their sentence audio, choose an actual existing deck, and send only those selected cards.
- Demonstrate that editing an approved sentence clears approval and blocks further delivery until reapproved.
- Verify the intended note count, final deck placement, audio, and same-mode repeat-send behavior in the test profile.
- Product owner reviews card usefulness and usability; attach evidence and resulting adjustments. Document prototype shortcuts and schedule their production replacements.
- Use the fixed P01–P05 inputs and the [prototype acceptance checklist](PROTOTYPE_PLAN.md#prototype-acceptance-scenarios). Report all AP-01–AP-13 results, distinguishing real integrations from controlled fault tests; unresolved blockers keep the gate open.
- This first integrated hosted/direct path does not close the remaining Piper/export/packaging/reliability release work.

## Release criteria and issue format

AV-017 through AV-025 are required before desktop release; refine their criteria using the [project test scenarios](PROJECT.md#required-test-scenarios) and [release checklist](DELIVERY_PLAYBOOK.md#9-quality-and-release-responsibility). A passing five-word prototype does not complete the release milestone.

Use the [contribution issue format](../CONTRIBUTING.md#work-item-format) when transferring these rows into the live board. Include the human owner and reviewer, readiness, acceptance evidence, and links to dependencies. Do not mark any ticket complete merely because a document lists it.
