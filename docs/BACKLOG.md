# Development backlog

**Version:** 0.3

**Date:** November 2, 2026

**Status:** AV-028 through AV-036 are the current local-web implementation sequence. AV-001 through AV-027 remain historical Electron-first records and must not be started automatically. Listing a task does not assign it or authorize work; the user selects each task explicitly.

The owner accepted the [local web direction and initial requirements](LOCAL_WEB_PLAN.md) on November 2, 2026. The current backlog divides that workflow into small reviewable outcomes. It preserves the old IDs instead of reusing AV-006 through AV-027, so commits and evidence remain unambiguous.

## Current local-web task inventory

| ID | Outcome | Priority / phase | State | Owner / reviewer | Dependencies |
|---|---|---|---|---|---|
| AV-028 | Read-only loopback web foundation with Anki status and deck discovery | P0 / foundation | In review; automated and live connected-Anki checks recorded, human acceptance pending | Unassigned / Unassigned | Reuses AV-002 tooling and AV-004 Anki contracts |
| AV-029 | Paste/import English Coach cards and save the pending queue locally for offline use | P0 / import | In review; implementation and local checks recorded, human acceptance pending | Unassigned / Unassigned | AV-028; accepted import fixtures and local store requirements |
| AV-030 | Review, edit, include/exclude, copy, and preview cards one by one | P0 / review | In review; implementation and local checks recorded, human acceptance pending | Unassigned / Unassigned | AV-029; English Coach profile/template |
| AV-031 | Enforce exact-revision content approval outside React and invalidate it on edits | P0 / safety | In review; controlled checks recorded, human acceptance pending | Unassigned / Unassigned | AV-030; relevant AV-003 contracts |
| AV-032 | Extract and select target/front/additional-example audio items | P0 / audio preparation | In review; implementation and controlled checks recorded, human acceptance pending | Unassigned / Unassigned | AV-031; English Coach audio-field rules |
| AV-033 | Generate, cache, play, compare, and retry audio individually or in batches | P0 / audio | Backlog | Unassigned / Unassigned | AV-032; selected TTS provider/voice and confirmed allowance |
| AV-034 | Create approved English Coach notes with audio in an explicitly selected Anki deck | P0 / delivery | Backlog | Unassigned / Unassigned | AV-028, AV-031, AV-033; disposable Anki profile |
| AV-035 | Load supported notes and safely update fields or replace one audio placement in place | P0 / update | Backlog | Unassigned / Unassigned | AV-034; stable identity and reconciliation evidence from AV-004 |
| AV-036 | Demonstrate and accept the complete five-card local workflow | P0 / acceptance gate | Backlog | Unassigned / Unassigned | AV-029 through AV-035 |

Only one of these tasks should be treated as the active implementation task unless the team explicitly coordinates parallel work. A task becomes Done only after its acceptance evidence is reviewed and accepted; a passing implementation review alone is not product acceptance.

## Current local-web acceptance criteria

### AV-028 — Read-only local web foundation

- `npm run dev:web` starts a browser application and server bound only to loopback; every HTTP/WebSocket listener opened by the command is verified as loopback-only.
- The browser shows sanitized server/Anki status and refreshes it without receiving the Anki collection session or credentials.
- With a disposable Anki profile, list and sort existing normal, filtered, and nested decks when the required AnkiConnect capabilities are available.
- Reject unexpected request hosts/origins and all mutation methods; this task exposes no card, media, or Anki write command.
- Runtime schemas reject invalid provider/Anki and browser/server boundary data. Automated checks and both historical Electron and local-web builds remain green.
- Record unavailable-Anki and connected-Anki results separately. AV-028 remains open until a human owner accepts it.

**AV-028 evidence (November 2, 2026):** Commit `609f642` passed `npm run check` (69 tests, typecheck, lint, formatting, Electron and web builds). With Anki unavailable, `GET /api/status` returned HTTP 200 with an `unavailable` state. A Chrome browser smoke test rendered the foundation screen. An exact process-scoped listener check found only `127.0.0.1:43110` and `127.0.0.1:24678`; a foreign HTTP Host returned 403. Code review found and then verified the fix for Vite's WebSocket loopback binding.

**Live connected check (November 2, 2026):** Started Anki 26.09.3 from the isolated `.tools/anki-av004` base and opened the disposable `User 1` profile. The installed add-on listened on `127.0.0.1:8765`, matching the web server default. The local API returned `connected`, the expected disposable profile, three sorted normal decks including one nested deck, and no collection session in its JSON. Chrome rendered the connected state and all three deck options. This was read-only; no note or media operation was invoked. The profile had no filtered deck, so filtered-deck discovery was not observed live. Human acceptance remains pending.

### AV-029 — Card paste/import

- Paste one or more cards in the official English Coach text structure and preview detected card boundaries before adding them to the queue.
- Import documented UTF-8 TSV, CSV, and structured JSON fixtures; show row/card errors without discarding other valid entries.
- Preserve the exact original source text for comparison. Import performs no model, audio, media, clipboard, or Anki write operation.
- Validate the profile structure at runtime, including required headings, conditional sections, and the agreed four-to-five additional examples.
- Freeze representative valid, invalid, multiline, quoted, and non-ASCII fixtures in the task evidence before declaring the formats supported.
- Save the original source, parsed cards, validation findings, and stable local source IDs in a server-owned, versioned store outside the repository. Choose and document a store with atomic writes and recovery from an interrupted save.
- Reopen the browser and restart the local server with Anki closed; the same pending queue must return without another import. A malformed or interrupted save must not silently replace good work.

**AV-029 implementation evidence (November 2, 2026):** The import panel accepts pasted official card text or UTF-8 `.txt`, `.json`, `.csv`, and `.tsv` files using [documented formats](IMPORT_FORMATS.md). It reports each card's validation issues, lets the user select valid entries, and stores them in a server-owned version-1 JSON workspace. Each write uses a temporary file and rename; a malformed existing workspace fails closed. `npm run check` passed (75 tests, typecheck, lint, format, Electron and web builds). A local API smoke test previewed one valid and one invalid card, saved only the valid card, then recovered it from the same isolated store after the server restarted; Chrome rendered the recovered pending card. A subsequent isolated run pointed AnkiConnect at an unavailable test port and still loaded the pending card. Tests used fixture content and a disposable local store. The store protects against interrupted process writes; power-loss durability is unverified. No linguistic review or production Anki write is claimed.

### AV-030 — Card review and preview

- Navigate imported cards individually; edit fields, include/exclude an item, discard unsaved edits, and retain the rest of the queue.
- Show clear `Ready`, `Needs attention`, and `Edited` states and prevent structurally invalid cards from advancing.
- Render accurate English Coach front/back previews with the official heading order and no unintended Spanish content outside the prompt-defined pronunciation tip/translation fields.
- Copy the reviewed official card text without changing application or Anki state.
- Provide keyboard-accessible controls and a usable narrow-screen layout. Verify behavior with fixtures rather than a live text provider.
- Persist committed edits and inclusion state through browser/server restarts while Anki is unavailable; clearly distinguish unsaved form edits.

**AV-030 implementation evidence (November 2, 2026):** The local workspace now reads AV-029 version-1 records into a version-2 review model without rewriting them on read. Individual saves persist edited fields, inclusion, an incremented revision, and the original imported fields/source; stale revisions conflict. Browser checks on an isolated store with AnkiConnect unavailable edited a meaning, recovered it after a server restart, retained include/exclude after reload, and copied the official card text. A second check confirmed that typing a new list item preserves its newline and that a two-tab stale-save conflict leaves the losing draft visible. The user's five-card Markdown attachment exposed an AV-029 paste-parser gap: bold headings, blank front lines, and long dash separators. After the fix, the running API preview returned five structurally valid cards without saving or modifying the attachment. Fixture tests cover migration, invalid/stale edits, heading order, and the Markdown import shape. `npm run check` passed (79 tests, typecheck, lint, formatting, Electron and web builds). No linguistic review, human acceptance, or Anki mutation is claimed.

### AV-031 — Exact-revision approval

- Create a deterministic revision identity from all deliverable card content and record explicit approval on the local server, not solely in browser state.
- Reject audio or delivery commands for invalid, excluded, unapproved, or stale revisions.
- Editing any card field creates a new revision and clears content approval; reverting content does not silently manufacture approval.
- Return a clear conflict that lets the browser refresh when its displayed revision is stale.
- Cover approval, invalidation, replay, and tampered-command cases with controlled tests.
- Recover the recorded approval and exact revision after a server restart; no browser-only approval state counts.

**AV-031 implementation evidence (November 2–3, 2026):** The local server now computes a deterministic SHA-256 identity from validated English Coach fields, records explicit approval for the current revision, and provides a serialized `withApprovedCard` action boundary for future audio or delivery work. Any content or inclusion edit increments the revision and clears approval; reverting content does not restore it. The browser offers an approval action for a saved, valid, included revision and a refresh action after a stale-revision conflict. Version-1 and version-2 workspaces load into the version-3 model without inventing approval. Controlled tests cover persistence across a store restart, idempotent replay, serialized approved action versus edit, stale hash/revision conflicts, excluded and unapproved cards, and tampered content on disk or in a proposed card. The HTTP test confirms mutation requires the session token and stale approval requests return 409. A November 3 live check found a version-2 Node process still serving the hot-reloaded version-3 browser UI, which prevented workspace loading and disabled import preview. Restarting the server restored version-3 workspace loading; import preview is now available independently of saved-workspace loading, with a separate session token from `/api/status` and a retry action for saved cards. A controlled test covers preview while workspace data is unreadable. The live browser preview control responded to input without saving a card; browser file selection itself was not observed because the automation extension blocked file upload. `npm run check` passed (86 tests, typecheck, lint, formatting, Electron and web builds). Audio and Anki delivery commands do not yet exist, so integration of their future command handlers with this guard remains for AV-033/AV-034. No human card-content approval or Anki mutation is claimed.

### AV-032 — Audio extraction and selection

- For an approved English Coach revision, extract only `target`, `frontExample`, and every `examples` item as distinct placements.
- Do not select meanings, headings, category, irregular forms, IPA, pronunciation guidance, chunks, usage notes, alternatives, or Spanish translation by default.
- Show source placement, exact text, include control, character count, and current/stale/missing status before generation.
- Support selecting one, several, or all missing placements without rewriting or correcting their text.
- Reject extraction/generation preparation when approval refers to a different revision.

**AV-032 implementation evidence (November 3, 2026):** The `av005-5` profile now selects `target`, `frontExample`, and every `examples` item for audio; historical profile selectors remain unchanged. Server extraction returns stable placement IDs, front/back source, exact saved field text, speech text with only display bold markers and surrounding quotation marks removed, character count, and missing or invalid status. Markup-only speech text leaves just that item invalid; its saved source remains visible and other placements remain selectable. The local server requires exact saved approval before returning a plan or saving a selection. Selected placement IDs are stored with revision and content hash in workspace version 4; version-3 approved cards load with no invented selection, and edits clear both approval and selection. Controlled tests cover field exclusion, one/several/all selections, restart recovery, stale or invalid requests, and HTTP origin/session guards. `npm run check` passed (91 tests, typecheck, lint, formatting, Electron and web builds). An isolated browser check with a disposable card showed six missing placements, selected all six, and recovered the selection after reload. The main local server was restarted and returned version 4 with the user's five saved cards intact. Current/stale audio statuses cannot appear yet because no audio associations exist before AV-033; audio generation, playback, and Anki writes were not performed. Human acceptance remains pending.

### AV-033 — Audio generation and review

- Generate one item, selected items, or all missing items through a server-side TypeScript adapter; provider keys never reach React, logs, cards, exports, or Git.
- Before a batch, show the selected provider, voice, format, clip count, characters, and only allowance information the provider actually reports.
- Cache only exact text/provider/model/voice/settings/format matches. Preserve successes during partial failure and retry only missing or explicitly selected failures.
- Play every proposed clip before delivery and allow comparison where a replacement is proposed. Changed source text makes the old association stale.
- Use fake providers for ordinary tests and separately record real listening evidence, actual model/voice/format, allowance authorization, and human voice-quality decision.
- Store successful audio artifacts and associations locally so they remain playable after browser/server restart without Anki running. The selected provider may still require internet access.

### AV-034 — Create notes in Anki

- Require an explicit existing destination deck and revalidate the active collection/session, deck, approval, and audio readiness immediately before writing.
- Show per-item create/omit intent, note type, destination, validation, and audio readiness before confirmation.
- Create the app-owned versioned English Coach note type/notes, upload uniquely named media, and use dedicated audio fields without changing source sentence fields.
- Persist stable source identity and per-item receipts; repeat delivery does not duplicate notes or request unnecessary audio.
- Reconcile ambiguous creation by source identity before retrying and report partial success accurately. Verify in a disposable Anki profile.
- Keep pending delivery intent and per-item receipts across disconnects. Reconnection never triggers an automatic send; show the current profile and destination for explicit confirmation, then revalidate before writing.

### AV-035 — Load and safely update notes/audio

- Load only supported English Coach notes from the chosen deck and show field-level before/after differences.
- Update an existing note in place without deleting/recreating it; retain note/card identity and studied scheduling evidence.
- For one audio placement, play the current and proposed clips, require confirmation, upload a uniquely named replacement, and change only that reference.
- Do not automatically overwrite or delete the old media file. Block unresolved collection or cross-mode identity reuse.
- Re-read the note and relevant identity/scheduling data after the update and record real disposable-profile evidence.

### AV-036 — Five-card acceptance workflow

- Import at least five English Coach cards, expose invalid input, and review/edit every valid card with accurate previews.
- Approve exact revisions, demonstrate that an edit clears approval, and extract the target/front/additional-example audio placements only.
- Generate and listen to one clip and all missing clips, including a controlled partial failure and resume.
- Create selected notes in an existing nested deck, repeat delivery without duplicates, then load one note and replace one clip without changing identity or scheduling.
- Record automated, fake-provider, real-provider, real-Anki, linguistic, and voice-review evidence separately. Product-owner acceptance is required to close the gate.
- Demonstrate offline import/edit/audio preparation and recovery after a server restart, then reconnect Anki and confirm that no queued item is sent until the user explicitly initiates delivery.

## Historical Electron-first backlog

This section is retained as design and feasibility history, not as the current issue-board baseline. Dilan, Bulma, and Trunks are confirmed full-stack developers. The owners/reviewers below were proposed initial assignments and were not confirmed merely by appearing here. See [DELIVERY_PLAYBOOK.md](DELIVERY_PLAYBOOK.md). Rows are not remote issues or assignments sent to people.

The readiness pass is documented in [PROTOTYPE_PLAN.md](PROTOTYPE_PLAN.md): proposed configuration, open decisions, and AP-01–AP-13 acceptance scenarios. [AI_EVALUATION.md](AI_EVALUATION.md) fixes the five prototype inputs and defines additional learning/response cases. The integrated five-item demo and linguistic review remain pending; task-specific execution evidence is linked above.

Priority `P0` means establish this prerequisite or resolve a critical risk early; `P1` means required for the desktop release; `P2` means future work. It does not mean every P0 item can start simultaneously. `Ready` requires the working-agreement criteria; items below start in Backlog until refined and prerequisites checked.

### Historical task inventory

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

### Historical initial parallel-work proposal

After kickoff, Dilan establishes the development skeleton while Bulma refines shared contracts and evaluation fixtures. Trunks prepares the Anki test environment and experiment plan. Merge the minimum shared contracts before consumers depend on them.

After foundation, Trunks runs AV-004, Bulma runs AV-005, and Dilan runs AV-007. Trunks completes the hosted-speech experiment next and Dilan completes packaging feasibility, or they pair/reassign work if it becomes the bottleneck. Do not start several active tickets per person to make the board look busy.

During the first workflow, Dilan builds the preview against fixtures, Bulma implements saved drafts and approval, and Trunks integrates speech and Anki against the agreed commands. AV-016 is a shared demonstration, with Dilan responsible for assembling the acceptance evidence. Tests and reviews remain part of each feature ticket, not deferred entirely to AV-021.

### Historical acceptance criteria

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

### Historical release criteria and issue format

AV-017 through AV-025 are required before desktop release; refine their criteria using the [project test scenarios](PROJECT.md#required-test-scenarios) and [release checklist](DELIVERY_PLAYBOOK.md#9-quality-and-release-responsibility). A passing five-word prototype does not complete the release milestone.

Use the [contribution issue format](../CONTRIBUTING.md#work-item-format) when transferring these rows into the live board. Include the human owner and reviewer, readiness, acceptance evidence, and links to dependencies. Do not mark any ticket complete merely because a document lists it.
