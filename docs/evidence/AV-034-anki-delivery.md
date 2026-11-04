# AV-034 creation delivery evidence

Date: November 3, 2026. Implementation is prepared for human review; milestone acceptance remains pending.

## Controlled checks

`npm run check` covers TypeScript, lint, formatting, unit tests, Electron build, and local-web build. Delivery tests use a fake JSON-RPC Anki server and diagnostic WAV provider. Cases cover:

- Preview without external mutations; explicit deck and listening acknowledgement at HTTP boundaries.
- Exact revision, approval, selected-audio payload, deck, and session checks before writes.
- Dedicated source/audio fields, escaped HTML/sound-tag input, and versioned model verification.
- Repeat and replay without duplicates, including a restarted delivery service.
- A response lost after creation, reconciled by source identity; an absent ambiguous creation remains blocked.
- Duplicate source identities, changed models, missing notes/media, media collisions, and cross-profile reuse.
- Mid-batch disconnects: failed and not-attempted results persist and later explicit recovery completes without duplicates.
- Original preview omissions remain in final and replayed results. Changed delivered content is blocked for the later update workflow.

## Live isolated Anki check

The running Anki process command line was verified as `Anki.exe -b C:\projects\anki-vocabulary\.tools\anki-av004 -l en`. The API reported Anki 26.09.3, API major 1, disposable profile `User 1`. No learner collection was used.

| Item | Observed value |
|---|---|
| Run | b6779d8a-ab30-4ecf-a11d-7b6c6f7bb84f |
| Existing nested deck | AV004::4e77c223 |
| Deck ID | 1793530170212 |
| Source ID | 18feb9e0-4e09-4998-976e-ce270152025d |
| Note ID | 1793713181278 |
| Card ID | 1793713181284 |
| Owned note type | AV_EnglishCoach_v1_c81eca3989f2471d834e460120683390 |
| Note-type ID | 1793713177805 |
| Notes created | 1 |
| Dedicated populated audio fields / media uploads | 6 / 6 |

One structurally valid disposable English Coach fixture was explicitly approved by the test harness. Its target, front example, and four additional examples used locally generated diagnostic tones, not speech. The preview performed no Anki mutation. Confirmation created the owned model, uploaded/checksummed six files, and created/read back one note. Target and front sentence source fields remained unchanged. `cards.render` returned front/back content with expected headings and without repeating the front sentence on the back.

After reconstructing the delivery service and workspace from disk without a speech provider, a fresh preview/confirmation returned `unchanged`. Note creation count remained one, media upload count remained six, and card identity and scheduling snapshots were identical. No study answer was recorded.

An earlier failed attempt exposed Anki's filename shortening: a 121-character requested media filename was shortened. Verification blocked note creation. Delivery now uses a 71-character SHA-256-based filename incorporating namespace, exact request key, and media checksum. The failed attempt left only its app-owned model and diagnostic media in the disposable collection; no automatic cleanup was performed.

## Browser check

The isolated web server used the live fixture workspace. Choosing the existing nested deck and included card produced a preview with profile, deck, model, and `unchanged` item intent. The Send button remained disabled until the test's explicit review/listening acknowledgement. Confirmation returned unchanged/complete and the same note ID. Reload recovered the receipt while clearing the send preview and destination selection; no automatic send occurred. The acknowledgement was a controlled fixture interaction, not human linguistic or speech-quality acceptance.

Local run files are ignored under `.tools/av034-live-b6779d8a-ab30-4ecf-a11d-7b6c6f7bb84f/`. Saved intents and receipts use a separate `delivery/delivery.json` file; raw Anki session tokens remain in server memory and do not reach the browser or saved delivery records.

## Temporary speech-key recovery

A subsequent user report showed generation disabled after a server restart and delivery blocked by missing selected clips. The temporary ElevenLabs key was absent from the restarted process; existing cached clips remained available. The app now explains the missing key and offers `npm run dev:web:with-key`, a hidden interactive prompt that keeps credentials in the server session. Blocked delivery previews identify the card and instruct the user to generate or retry missing selected audio before preparing again. Approval and audio-readiness checks remain enforced.

Hidden-input unit tests cover editing, cancellation, no echo, terminal-mode restoration, and rejection of redirected input. A Windows PTY check with a fake value confirmed hidden entry and cancellation. Launcher checks also rejected an occupied port and noninteractive input. No real provider call or new Anki delivery was performed for this recovery change; restoring actual generation requires the owner's local key entry.

## Reopening the isolated collection

After the owner reopened Anki through its normal shortcut, the running process used the regular data directory, which lacked the supported add-on, and the local app correctly reported Anki unreachable. The owner explicitly chose to continue with the isolated test collection. The regular instance was closed normally and `npm run anki:test` launched the existing `.tools/anki-av004` collection with profile `User 1`. The process arguments and live status endpoint confirmed the intended base directory, Anki 26.09.3, and AV004/AV004::4e77c223/Default decks. Repeating the command while Anki was open refused to launch another instance. No add-on was copied into the regular collection and no card was sent during this recovery.

## Remaining acceptance limits

A later browser inspection found the actual failed preparation message, "Could not verify allowance," below the full audio list. The UI now places feedback above generation controls, and queue preparation preserves actionable audio errors. The adapter classifies account-access denial (401/403), rate limiting (429), and other allowance-check failures into fixed public codes without exposing provider bodies or credentials. Fake-response tests cover these cases, transport/schema failures, and successful allowance parsing. `npm run check` passed with 121 tests, type/lint/format checks, and both builds. The existing server was left running to preserve its temporary key; new backend diagnostics require a restart. No new speech request was made. The live account failure's precise cause remains unverified pending the owner's key-permission check.

This proves creation and repeat reconciliation with diagnostic media. Human listening in Anki Desktop/mobile, real speech delivery quality, complete five-card acceptance, and studied-note updates/replacement remain unclaimed. Existing-note changes are blocked in AV-034 and belong to AV-035. No new provider request or paid service was used.
