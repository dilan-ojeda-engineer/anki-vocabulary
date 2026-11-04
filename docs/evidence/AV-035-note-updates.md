# AV-035 — Existing-note updates

**Status:** Implementation validated with 155 tests, builds, AI-assisted review, and the integration evidence below. On November 4, 2026, the owner reported that the tested update workflow worked as expected and explicitly authorized committing and merging AV-035. The separate five-card milestone and broader speech-quality acceptance are not inferred from that report.

## Supported workflow

The local workspace lists previously delivered app-owned English Coach notes for the explicitly chosen normal deck. A verified delivery receipt and the linked local source must exist. Loading rechecks model layout, source uniqueness, note/card identity, deck, current Anki fields, and referenced media. Other note types, namespaces, unresolved identities, and external field changes are blocked. A saved note is not imported into a new unrelated source identity.

Loading is read-only. The owner may explicitly use its verified values as the linked local draft, which uses the existing revision/approval rules, or keep and edit the current local draft. The existing editor supplies field validation, front/back preview, saving, and exact-revision approval. Unsaved local edits disable update preparation. The legacy AvContent payload is used only as a reconstruction candidate after its typed content hash and every rendered teaching field match the actual note and receipt; it cannot override a manual Anki edit or establish approval.

An update preview shows teaching-field before/after values, current/proposed changed audio, destination, note ID, and approved revision. Confirmation is explicit. Content updates use the current selected verified audio and preserve unselected verified Anki clips whose extracted spoken text is unchanged. If spoken text with existing audio changes, its selected updated clip must be ready before preparation succeeds. A content-only update can select no clips when existing speech is unchanged. Removing an example explicitly removes its audio reference in the preview. A one-placement audio update requires unchanged approved content and patches only that audio reference. Internal metadata remains on the existing layout; AV-037–039 are not implemented here.

## Fresh audio and cache behavior

Generate replacement requests one fresh rendition after the normal allowance preview and confirmation. Its artifact ID incorporates the exact request key and returned content checksum; the existing cached file remains intact. Normal selected/missing generation retains a complete replacement instead of silently returning the original canonical clip. Failed replacements persist their intent across restart and count their complete fresh character cost when retried. Old clips remain available for comparison. Identical returned bytes can reuse an identical replacement artifact after the provider call.

## Update consistency and recovery

Creation and update services share one serialization queue. Loaded snapshots and update previews are session-bound in memory. Immediately before a patch, the server checks the destination/model, exact approved saved revision, selected audio, source identity, actual note contents/tags, and card identity/scheduling. Media uploads use verified unique names and reject collisions; old media is never overwritten or deleted. The server checks the snapshot again after uploading and patches only changed fields on the existing note.

`delivery/updates.json` persists pending intent before any upload and `writing` before the note patch. It records original/proposed fields, original card scheduling, ownership, and the proposed delivery receipt. Readback verifies exact proposed fields, unchanged tags/card IDs/deck/scheduling, and Anki media checksums before completing the delivery receipt. Lost responses remain ambiguous. Explicit reconciliation checks the actual note and either completes an observed update, reports an unchanged original without resending, or blocks a conflict. Repeated confirmations never blindly patch again. Raw collection-session tokens remain in memory and are excluded from responses and journals.

Anki's native `editorConflict` rejection is reported as not applied, with instructions to save/close the affected editor and prepare a new confirmation. Uncertain transport outcomes continue to require reconciliation. No scheduling reset, card deletion/recreation, note-type migration, old-media deletion, or automatic send on reconnect occurs.

## Controlled validation

Tests use fake Anki JSON-RPC, diagnostic WAV bytes, and isolated temporary stores. They cover read-only load/playback, explicit draft restoration, exact approval and selections, one-placement replacement, successful replacement retention, failed replacement retry after restart, before/after field differences, native editor rejection, studied scheduling preservation, duplicate sources, changed layouts/sessions/cards/fields, lost responses before/after commit, restart reconciliation, and HTTP host/origin/session/schema/listening acknowledgement boundaries. Test fixtures shared with AV-034 preserve its creation regression coverage.

Final `npm run check` passed 142 tests plus type/lint/format checks and both builds. Peer review identified deck-switch editor visibility, failed replacement retry, and successful replacement retention issues. All three were fixed and re-reviewed without further blocking findings; regression coverage includes retry after service reconstruction and ordinary generation retaining a successful replacement without another provider call.

## Live disposable-Anki validation

The running Anki command line was verified to use `C:\projects\anki-vocabulary\.tools\anki-av004`, disposable User 1, with the existing AV004 nested test deck. The first fixture attempt stopped at `noteTypes.create` with native `editorConflict`; no fixture note or media was created. Existing open editor drafts were not discarded. Instead, the successful run reused an existing owned AV-034 diagnostic fixture and copied its local test data into an isolated run directory. It did not require creating a model or bypassing the editor guard.

Run `6ce7dfaa-e37f-4b21-97c3-04153384abf6` completed against Anki 26.09.3. Its local artifact is `.tools/av035-existing-6ce7dfaa-e37f-4b21-97c3-04153384abf6/av035-result.json` (ignored test data).

| Check | Observed result |
| --- | --- |
| Destination | User 1, `AV004::4e77c223` |
| Existing fixture | Note `1793713181278`, card `1793713181284` |
| Content update | Meaning updated and read back as complete |
| Single audio update | Only `AudioTarget` changed; original media retained |
| Identity and scheduling | Same note/card IDs, deck, review queue, five-day interval, repetitions, lapses, and ease |
| Review history | Existing one-review history unchanged; no new study answer recorded |
| Repeat and restart | Repeated confirmation and reconstructed-service reconciliation returned complete without another patch |
| Calls | Two `notes.update` calls; one fake diagnostic-WAV synthesis; no real speech generation |

The main workspace's user cards were not used for these mutations. The real integration verifies Anki behavior with fake audio; it does not establish speech quality or human acceptance.

Browser validation against the running local app loaded the owned `put off` note from Testing Deck, showing its linked approved editor, six current audio players, replacement controls, and content/single-audio preview actions. Switching decks restored pending-card review. No user-card update or speech generation was submitted. The older `draining` receipt in AV004 points to note `1793727544986`, which the current Anki API reports as not found; the UI blocked loading rather than recreating it. Resolving that stale receipt remains separate from this successful supported-note check.

## November 4 audio-preservation regression

Owner testing exposed a content-update defect: rebuilding the audio fields from a partial selection silently cleared unselected references. The `put off` update journal shows six populated references before the update and only `AudioExample1` afterward. Several spoken fields had also been edited. The model inspection found 28 uniquely named fields and exactly one template reference per audio field; no duplicate field definitions were present. Media files and before-update journal snapshots remain retained.

The fix uses the same preservation plan during preparation and confirmation. Unchanged unselected speech keeps its verified existing reference. Changed speech with existing audio blocks preparation until selected matching audio is ready, avoiding both silent removal and stale speech reuse. The UI explains these rules. Three new tests cover partial selection, content-only empty selection, and blocked changed speech followed by a valid replacement. Final `npm run check` passed 145 tests, type checking, lint, formatting, and both builds. The reviewer found no further actionable issues in the fix.

A live fake-WAV regression run against the same isolated studied fixture completed: run `ec418007-cf15-4c78-8bd3-d8563f01ce1e`, artifact `.tools/av035-preservation-ec418007-cf15-4c78-8bd3-d8563f01ce1e/av035-preservation-result.json`. A meaning update with one selected freshly generated target clip changed only `AudioTarget` among audio fields, preserved the other five populated references, and retained note/card IDs and scheduling. No real speech call or user-card mutation was used in this regression run.

The owner subsequently explicitly requested restoration of the original `put off` text and audio. The pre-update journal snapshot was validated against its stored content hash, rendered teaching fields, original imported fields, source identity, current note, and verified original cached audio. A credential-free recovery backup was created at `.tools/put-off-recovery-8bc97758-71b0-4815-a842-31049f5c6808/`. Using the normal workspace approval, cache reuse, update preview, confirmation, and readback services restored the linked local card as revision 5 and note `1793743496128` in Testing Deck. All six original audio references and teaching fields matched the pre-update snapshot afterward. Note/card IDs, deck, scheduling, and complete review history were unchanged. Provider synthesis calls: zero. The result is recorded in that backup's `restoration-result.json`; the local server was restarted after recovery. Human listening remains pending.

## November 4 preview-feedback follow-up

The owner reported that clicking content/audio preview after generating one example appeared to refresh without a result. A read-only request reproduced HTTP 400: the saved revision 8 selected all six placements, while only additional example 1 had current audio; the other five were stale. Target and front-example text also contained test edits. The original HTTP response replaced the known audio cause with a generic message, and the UI displayed that message far above the controls.

Known audio-delivery failures now use an application-authored error type with a static placement label and actionable guidance. Both existing-note HTTP errors and creation receipts retain these safe details; arbitrary provider/storage errors remain generic. Existing-note feedback appears next to the preview controls and receives focus; a successful preview separately receives focus and scrolls into view. Approval, audio validity, and explicit update confirmation are unchanged.

The HTTP regression verifies an incomplete Target error reaches the client without any Anki write. The full check passed all 145 tests, type checking, lint, formatting, and both builds. The first full run exposed a creation-receipt exact-message mapping regression; it was fixed before this final pass. Focused peer review found no actionable issues. On the running app, a blocked preview displayed the specific stale Target explanation in the accessibility tree and focused its feedback container. Screenshot capture returned a blank image, so visual screenshot verification and the successful-preview browser path are not claimed. No speech generation or Anki update was performed during this diagnosis.

## Guided update usability follow-up

The owner approved simplifying the update UI after finding audio selections and overlapping preview actions confusing. The update editor now presents Edit card, Prepare audio, Review changes, and Update in Anki. Save and continue saves text and approves the exact saved revision through the existing server commands. Audio guidance compares normalized spoken text against the loaded Anki values, preserves unchanged clips, and requires matching audio only for changed speech with existing clips. Adding audio to previously empty placements remains optional. Ready clips are selected automatically for the single review action. Per-clip Replace audio retains generation preflight/confirmation and old media; final Anki confirmation remains separate.

Six pure planning tests cover unchanged revision transitions, partial generation, normalized markup, optional audio, removed examples, and failed clips. A server integration regression follows partial generation into automatic selection and a confirmed update, preserving the unchanged target clip and studied identity. Peer review found an unsaved-draft navigation bypass; guards now cover note loading, deck changes, connection refresh, and browser unload, and the reviewer confirmed the finding resolved.

Browser checks used an isolated static-build harness with fake Anki and diagnostic WAV generation, directory `.tools/av035-ui-8243a66c-c906-45a0-8aad-57be447e823e/`. Save and continue advanced an unapproved saved draft into audio preparation. A meaning-only change needed no regeneration and reviewed zero audio changes. An unsaved front-sentence edit disabled note/deck navigation and Refresh. Saving it produced exactly one required generation action; confirmation generated one fake clip, then the single review showed two text changes and one audio comparison. The final acknowledgement enabled the fixture update. Readback recorded one update changing FrontExample, Meaning, AudioFrontExample and local tracking metadata, while leaving AudioTarget unchanged and the fixture studied. `guided-ui-result.json` records these results. The two setup clips plus the new clip used three fake synthesis calls; no real provider or real Anki writes were used for this UI check. The acknowledgement was a simulated control check, not human speech-quality acceptance. Screenshot capture still returned a blank image, so visual screenshot verification is not claimed.

Final `npm run check` passed 152 tests across 18 files, type checking, lint, formatting, and both builds. The real local app was also checked: regular Anki was running without the configured test endpoint, so live owner-collection UI acceptance requires reopening the existing isolated test collection. No regular collection was closed or modified. The [update guide](../UPDATE_CARD_GUIDE.md) documents the new flow.

## Editing-session expiry recovery

Owner testing exposed a five-minute expiry on the loaded editing snapshot while generating/listening to audio. Review changes then stopped with Loaded note expired, although the saved draft and audio were intact. Editing snapshots and opaque playback links now remain available without a short timer while the service runs. Their maps use bounded least-recently-used eviction (100 editing contexts, 1,000 immutable-artifact playback links); raw media bytes are not held in those maps. These links are read-only artifact references, not write authorization. Final write previews keep their five-minute expiry.

Every draft restoration, review preparation, and confirmed update still re-reads Anki and checks the existing session, identity, receipt, content, approval, and scheduling invariants. Restart/eviction recovery has an explicit Reload Anki snapshot action beside Review changes; it does not replace the saved local draft, change approval, regenerate audio, or send to Anki.

Three regression tests cover an hour-long editing/playback session followed by review, expiry of a final write preview and safe re-review, late external edits/collection changes, bounded editing-context eviction, and restart recovery preserving saved text and audio. All 19 focused note-update tests passed. Peer review found no actionable issues. Final `npm run check` passed 155 tests, type checking, lint, formatting, and both builds.

After deploying the fix, a read-only load and prepare request against the owner's current saved `put off` draft in the isolated collection returned HTTP 200 with three text differences and three audio differences. Workspace serialization and the audio manifest checksum were unchanged before/after; no speech generation or confirmed Anki update occurred in this check.

## Owner workflow verification

After the audio-preservation fix, guided-flow redesign, and editing-session recovery, the owner confirmed the review action worked, then reported: “I tested and it is as expected!” The owner subsequently instructed committing the work and merging it into main. This records the owner's manual workflow verification and merge authorization; the AI-assisted code reviews remain distinct from an independent human developer review. AV-036 and deferred features were not started by this authorization.

## Limits

The installed API offers `notes.update` without an atomic compare-and-swap precondition. Checks before/after the patch and the native editor guard detect many conflicts, but cannot eliminate a concurrent same-field mutation occurring inside the final network/write window. The UI asks the owner to close the note's Anki editor and avoid studying it while applying an update. Conflicts are reported; the app does not attempt an unsafe automatic rollback.

This task supports notes linked to this workspace's verified delivery records. Adopting untracked notes, repairing arbitrary external edits, migration to a smaller model, and dynamic note-type mappings remain separate work. Human speech quality/listening and five-card milestone acceptance are not inferred from diagnostic tones or automated tests.
