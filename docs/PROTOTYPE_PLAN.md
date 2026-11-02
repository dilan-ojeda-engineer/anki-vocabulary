# Prototype readiness and acceptance plan

**Version:** 0.1  
**Date:** October 11, 2026  
**Status:** Readiness documentation prepared; human choices, development setup, and executable evidence remain pending.

## Objective and boundary

Demonstrate a five-item batch through real text generation, review, explicit approval, sentence audio, and direct delivery to a selected existing Anki deck in a disposable test profile. Use the P01–P05 inputs in [AI_EVALUATION.md](AI_EVALUATION.md).

Keep this first integrated path narrow: one built-in profile, one text-provider candidate, ElevenLabs for initial audio, and AnkiConnect for delivery. Piper, package export, and packaged-Windows feasibility are early separate experiments and later integration tasks; both speech paths and both delivery paths remain required before release. The future web app and custom-profile editor do not enter this prototype.

This is an experiment configuration, not confirmation that candidate tools work or that a polished application exists.

## Proposed experiment configuration

| Setting | Provisional value | Evidence or remaining decision |
|---|---|---|
| Test inputs | P01–P05, fixed as written | Defined; expectation review and generated-card review pending |
| Application | Strict TypeScript, React/Electron, one repository | AV-002/008 verify setup and packaging; compatible package versions are not pinned yet |
| Profile | Built-in `english-coach`, initial immutable profile version | Operational adaptation derives from the archived prompt; AV-003 records exact schema and version/hash |
| Front/back layout | Target/example/question front; required sections back | Existing proposed interpretation in CARD_SPEC.md; Dilan's visual review pending |
| Text provider/model | Unresolved after AV-005 | [Actual evidence](TEXT_FEASIBILITY.md) is preserved; Groq candidates were not suitable for adoption and Gemini generation was unavailable during the experiment |
| Text output mode | Profile-derived JSON Schema when supported | Still perform runtime validation and human review; record actual request settings without claiming schema compliance proves semantic quality |
| Main-path speech | ElevenLabs | Hosted provider confirmed; actual available General American voice/model and supported file format selected after a listening check |
| Audio coverage | Front sentence plus four additional examples by default | Owner revised the count November 1, 2026: five clips per note, 25 clips for five notes; a fifth additional example remains allowed and creates another clip |
| Local speech experiment | Piper, through external runtime/voice installation | Local integration required; Python runtime proposal and actual voice/setup/license checks pending |
| Direct Anki connection | Configured loopback endpoint, currently proposed `http://127.0.0.1:8765` | Verify current installed API and capabilities, pairing, and a writable ordinary destination deck in AV-004 |
| Test destination | User-selected nested deck in a disposable collection | Select the actual deck at experiment setup; do not hard-code a learner's live deck |
| Storage/export candidates | SQLite/better-sqlite3/Drizzle; ankipack/sql.js for separate export experiment | Packaging, media, repeat import, and studied-note updates are unverified |
| Generation budget | Free-tier accounts without paid fallback | Confirm the account owner's allowance/billing state; pause on quota errors rather than buying capacity |
| Initial processing | One worker, sequential per-item jobs | Persist results/receipts; prevent double-clicks from starting duplicate work |

Five clips per note describes the chosen default, not a changed maximum. A run with five additional examples must report six clips for that note; retry/cache checks use actual expected clips rather than a hard-coded count of 25.

Exact provider settings and versions belong in experiment evidence. Voice IDs, model settings, allowances, and runtime compatibility must not be invented in advance. This document grants no authority to use another developer's account or to publish a release.

## Open items and ownership

| Item | Proposed owner | Needed before | Useful work that can proceed |
|---|---|---|---|
| Weekly availability, coordinating roles, and acceptance of initial assignments | Dilan with Bulma/Trunks | Scheduling commitments and real team assignments | Review existing scopes/criteria |
| Repository host, visibility, and account capabilities | Dilan | Shared remote setup, issue/PR/CI enforcement | Prepare local skeleton/contracts independently |
| Adopt or replace the text-model candidate and configure personal credentials | Bulma with product owner | Real text API experiment | Fake drafts, schema design, rubric review |
| Review the five-case expectations and visible layout/audio interpretation | Dilan with Bulma | Accepted learning evaluation and prototype demonstration | Build preview fixtures and structural checks |
| Select and listen to an available hosted voice | Trunks with Dilan | Approved real batch audio | Implement fake TTS and playback interface |
| Install/pair a disposable Anki profile and record current add-on/client versions | Trunks | Real deck discovery/insertion checks | Design receipt/reconciliation fixtures |
| Clarify local runtime preference and choose/test voice | Dilan with Trunks | Piper experiment and release packaging decision | Continue main hosted path |
| Identify actual mobile clients/devices | Dilan | Mobile pilot acceptance | Desktop prototype checks |

These items are pending; documenting an owner is not evidence that the team accepted that assignment. Remote hosting and mobile selection do not block independent core design work.

## Prototype acceptance scenarios

All scenarios below are **Not run**. Use isolated test data and app-owned source IDs; count matching notes rather than the entire collection, which may contain other notes. Record initial/final counts, revisions, deck IDs/names, and relevant receipts.

| ID | Given / when | Required observable outcome |
|---|---|---|
| AP-01 | Enter P01–P05 and generate | Five independent draft notes; original input/context retained; P01 correction shown; all required fields visible; no audio or Anki insertion occurs merely from generation. |
| AP-02 | One draft has invalid required content | Approval fails with a useful reason; that item creates no audio/delivery job; other valid drafts remain available. |
| AP-03 | In a fresh session approve only P01/P02 | Only those exact revisions enter audio work; sending includes only those two complete approved notes, not the other drafts. |
| AP-04 | Edit an approved sentence before delivery | Revision changes, approval clears, old approved revision cannot be sent. After reapproval, use audio for the changed sentence/selected voice; reuse unchanged clips only on exact cache matches. |
| AP-05 | Approve all five complete cards, select an existing nested deck, and send | Exactly five corresponding app-owned notes/cards in the chosen destination, with correct profile fields and all required audio available for replay. |
| AP-06 | Send the same five source identities again through direct delivery | Matching note count remains five; no new notes/cards or unnecessary speech requests. Delivery distinguishes already-current content from an approved update. |
| AP-07 | External insertion succeeds, then receipt persistence is interrupted | Restart/retry reconciles the source identity before creation; after finishing the batch exactly five matching notes exist. Test this deliberate failure point, not only a disconnect before any write. |
| AP-08 | In Anki, study one note; then approve a content update in the app and send | Same external note/card identities remain; updated content arrives without deleting/recreating the note or resetting scheduling. Capture scheduling immediately before/after update with no intervening review. |
| AP-09 | Anki disconnects or the destination disappears before send | Clear failure/pause, no silent default-deck insertion; saved drafts/audio remain available. Reconnect/refresh before resuming. |
| AP-10 | Text or speech allowance is exhausted or network fails | Save completed work and classified failure; pause affected jobs; explicit resume processes only remaining work. No automatic paid/provider switch. Controlled fixtures cover errors without deliberately exhausting an account. |
| AP-11 | Repeated clicks, renderer reload, or app restart occur during a job | One durable job per intended revision/audio/delivery operation; no duplicate insertion or lost approved content. Reconcile ambiguous external completion instead of blindly replaying creation. |
| AP-12 | A response is structurally valid but semantically wrong | It remains a reviewable draft. Human review flags/corrects it before approval; no automated claim that schema validity means correct English. |
| AP-13 | User changes Anki collection/profile or switches delivery mode for an already-delivered note | Unknown identity mapping is blocked pending re-pairing/reconciliation; no use of a stale numeric note ID and no unsupported promise of cross-mode merging. |

AP-01/05/06 and playback require real integrations in the final demonstration. Deterministic fake-provider/connection fault injection is appropriate for negative/recovery tests, but AV-004 must also prove how actual Anki notes are reconciled and updated. Record simulated versus real evidence distinctly.

## Demo gate versus release gate

The first integrated demo passes when P01–P05 are reviewed, AP-01 through AP-13 have appropriate evidence, and unresolved blockers are explicitly fixed. Use local worker-only temporary credential configuration for early experiments if needed; never expose keys to the renderer or commit them, and keep encrypted persisted settings as a release requirement in AV-019.

This gate does not replace separate Piper, export, native/WASM packaging, clean-machine, backup/restore, 50-item capacity, or mobile acceptance. It does not claim both delivery modes can be used on the same notes until identity reconciliation is tested. Later release requirements remain in [DELIVERY_PLAYBOOK.md](DELIVERY_PLAYBOOK.md#9-quality-and-release-responsibility).

## Evidence and readiness register

| Readiness area | Evidence prepared now | Still pending |
|---|---|---|
| Ordered prototype work | BACKLOG.md, AV-001–AV-016 criteria and dependencies | Human task acceptance, live board, actual implementation |
| Learning evaluation | AI_EVALUATION.md: five main cases, eight additional cases, seven pipeline fixtures, review rubric | Human expectation review, raw outputs, measured usage, corrected/approved cards |
| Experiment choices | Provisional configuration and open-item owners above; DECISIONS.md | Adoption of pending choices, runtime/client/provider configuration |
| Behavior acceptance | AP-01–AP-13 with observable outcomes | Executable checks and Anki evidence; none run |
| Engineering foundation | AV-002 scope and check requirements | Git, scaffolding, locked versions, commands, local/remote checks |

Record each experiment using its backlog ID, dated settings, results, sanitized evidence, and decision. Mark failed or unrun checks honestly. Do not close AV-001/005/016 or describe the application as ready merely because this planning document is complete.
