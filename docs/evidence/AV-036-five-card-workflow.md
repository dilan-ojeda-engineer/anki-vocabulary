# AV-036 — Five-card workflow acceptance

**Status:** Engineering checks and the isolated real-provider/real-Anki demonstration are prepared for owner acceptance. The owner approved all five cards and all 30 current clips on November 4, 2026; final milestone disposition remains pending. The owner authorized commit and merge after review; no release or next task is implied.

## Scope and exact dataset

Baseline: `8b7892a` (merged AV-035). Branch: `codex/test/AV-036-five-card-workflow`. The new [five-card fixture](../../tests/fixtures/av036-cards.json) contains awkward, draining, went, put off, and fuel, each with one target, one front example, and four additional examples. Profile: `av005-5`. There are 30 current audio placements. See [content provenance and review](AV-036-linguistic-review.md), [proposed cards](AV-036-cards-for-review.md), and the [machine-readable run record](AV-036-run.json).

The dataset is manually adapted user-supplied material. It is not a new Groq/Gemini run, and does not overturn the archived AV-005 provider-quality findings. Archived prompts, raw model outputs, and comparison attachments were preserved.

## Acceptance matrix

| Requirement | Observed engineering evidence | Human acceptance |
| --- | --- | --- |
| Import five cards and expose invalid input | Integrated test imports five valid JSON entries and rejects a sixth invalid entry without saving it. The isolated run records the same five-plus-invalid preview. | Owner accepted all five cards |
| Review/edit every card with correct previews | Test renders/round-trips all five front/back texts, edits and restores each card, and checks fields against the saved fixture. Browser navigation observed each target, official front question, and six current audio players. | Owner accepted all five cards |
| Exact approval and correct speech fields | Each controlled edit clears approval and selection; generation rejects unapproved revisions. Speech extraction includes only target, front example, and four additional examples. | Controlled approval is not human linguistic acceptance |
| One clip, missing clips, failure/resume | Fake quota failure preserves completed clips and resumes after service/server reconstruction. Ordinary cache retry performs no new synthesis. Real generation completes all 30 clips; the quota fault was not injected into the real provider. | Owner accepted all 30 current clips |
| Nested-deck creation and duplicate prevention | Five notes created in existing AV004::4e77c223 in isolated User 1. Reconstructed-service repeat returns five unchanged receipts; each source search returns exactly its original note ID. | Inspect the test cards in Anki |
| Replace one clip, preserve studied scheduling | Real replacement changes only AudioTarget on the first test note. IDs, scheduling and review history are preserved; old media remains available. | Owner accepted the replaced clip |
| Offline work, restart, explicit reconnect/send | Denied Anki transport allows import, editing, approval, speech preparation/generation and restart recovery. Workspace/audio hashes match after restart; zero receipts and zero own-source notes exist before explicit send. Reconnection alone creates none. | Optional physical-close walkthrough remains distinct from the transport fault |

## Controlled integrated test

Run `npm test -- tests/unit/five-card-workflow.test.ts`. It uses fake speech, fake Anki JSON-RPC, temporary stores and a loopback HTTP server. It covers the combined sequence rather than inferring integration from independent unit tests: invalid entry → offline review/edit/approval → single clip → injected quota pause → server/service restart → resume/cache retry → reconnect without automatic delivery → confirmed creation in a nested deck → repeat after reconstruction → one immutable replacement on a studied fixture.

It performs no credential reads, real provider requests, or real Anki writes. Existing boundary/recovery tests remain part of the full suite. The final post-editorial `npm run check` passed 156 tests across 19 files, type checking, lint, formatting, and both builds. The project-local requesting-code-review reviewer found no blocking findings in the test, fixture, provenance or evidence. That AI review is separate from human acceptance.

## Isolated real execution

Run ID: `c589e304-0e5a-408a-b62e-2fbb2e036041`. Local data: `.tools/av036-live-c589e304-0e5a-408a-b62e-2fbb2e036041/`. The acceptance server is separate at `http://127.0.0.1:43112/`; the normal workspace remains at port 43110. Credentials remain in the existing encrypted credential store outside both workspaces; no key was copied into fixtures, logs or backups.

The runner verified the Anki process command line selected `.tools/anki-av004`, disposable User 1, Anki 26.09.3, and the existing normal nested deck AV004::4e77c223. It did not close Anki, sync, alter the regular collection, or change the normal workspace's cards. Test notes use new source IDs and their own app-owned note-type namespace.

### Speech and cache

- Provider: ElevenLabs, Sarah, the existing configured model/settings in the run record.
- Initial account allowance: free, 1,315 used / 10,000 limit. Generation checked allowance before requests and had no paid fallback.
- 14 exact immutable artifacts reused from the normal cache; unrelated artifacts and source-card manifests were not copied.
- Initial generation: 16 real requests, 681 characters. All 30 placements completed.
- Fresh target replacement: one request, seven characters.
- Total new generation: 17 requests, 688 characters. MP3 validation/checksums and successful delivery do not establish naturalness or pronunciation quality.
- Non-spoken editorial changes cleared approval, were re-approved as controlled fixture revisions, and reused cached clips without provider synthesis. The later fuel audience-tip edit preserved every audio field in Anki.

### Offline restart

Anki stayed open while an isolated transport gate denied access. This is a controlled unavailable-endpoint test, not a claim that the physical Anki process was closed. Before/after restart records show five saved cards, zero delivery receipts, and identical workspace/audio manifest hashes. After reconnecting, searches found no notes for the five new source IDs until the explicit delivery action. This run did not simulate a real provider quota exhaustion; the quota/resume scenario belongs to the fake test.

### Real notes and replacement

| Target | Note ID | Card ID |
| --- | --- | --- |
| awkward | 1793818497278 | 1793818497278 |
| draining | 1793818502940 | 1793818502940 |
| went | 1793818507845 | 1793818507845 |
| put off | 1793818512664 | 1793818512665 |
| fuel | 1793818517479 | 1793818517479 |

One explicit Easy scheduler answer was recorded only on the new awkward test card to establish studied scheduling. The subsequent audio replacement retained that note/card identity, scheduling and the one-review history; it did not add another answer. Only AudioTarget changed in that update, and the old media file was read back successfully.

The separate later fuel editorial update changed the English audience guidance and tracking metadata, preserved all audio references and scheduling, and used zero synthesis calls. No existing learner note was deleted/recreated. Receipts/source IDs and fuller results are in the run record.

## Browser and owner handoff

The acceptance tab is visibly labelled as a separate AV-036 workspace. Browser accessibility checks navigated all five cards, confirmed the official front question and six current audio players on each, selected the nested test deck, and returned to the first card for owner review. Screenshot capture was unavailable; no screenshot QA or actual listening is inferred from those checks.

On November 4, 2026, the owner confirmed: “All five cards look correct and useful” and “All 30 clips are clear and match the text.” This records human content/usefulness and listening acceptance, including the replaced awkward target clip. It is separate from AI editorial review, automated checks, and controlled server approval records. The owner authorized commit and merge; final board disposition remains with the owner. The browser tab/server and test notes are retained so the owner can inspect them; normal workspace data remains separate.

## Reproduction and follow-ups

The committed-scope automated test and JSON fixture reproduce the controlled scenario without keys. For a manual live run, use a separate `LOCAL_WEB_DATA_DIR` and port, the existing disposable Anki setup, the five-card JSON fixture, and the ordinary app's import/review/audio/delivery/update commands. Check the actual free allowance before confirming speech generation. Do not target a learner's regular collection.

The local ignored `.tools/av036-live.ts` runner records this particular execution; it is not a packaged feature or a portable production command. The static acceptance server adds only a test-workspace banner and controlled transport gate. No new application infrastructure, provider, note-type mapping feature, migration, release or next backlog task was implemented.
