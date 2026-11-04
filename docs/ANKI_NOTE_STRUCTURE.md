# English Coach Anki note structure review

**Date:** November 3, 2026.

**Scope:** Review of AV-034 storage fields against the agreed English Coach content structure.

**Status:** Current implementation documented; the owner deferred the smaller-layout and migration work into future tasks AV-037 and AV-038. No schema change or migration is implemented by this review.

## Learning content and Anki fields

[CARD_SPEC.md](CARD_SPEC.md) defines the teaching content, headings, and order. An Anki note type stores the values used by its card templates. Those storage field names are not extra learning headings. The current implementation in [anki-template.ts](../src/server/anki-template.ts) renders only teaching content and selected audio on the front/back. Its internal `Av...` fields are visible in Anki's editor, but neither template references them. They are not confidential or protected from editing.

The owner requested this review after encountering those fields in Anki. The prompt does not request `AvSourceId`, `AvRevision`, `AvContentHash`, `AvProfileVersion`, or `AvContent`. Stable identity and delivery receipts are separate application requirements in AGENTS.md and [AV-034](BACKLOG.md#av-034--create-notes-in-anki); they do not justify adding teaching sections or duplicating all content without a demonstrated need.

| Agreed teaching content | Current Anki fields | Rendering |
|---|---|---|
| Target and primary example | `Target`, `FrontExample` | Front, followed by the fixed official question |
| Meaning | `Meaning` | Back, under Meaning |
| Category | `Category` | Back, under Category |
| Irregular verb forms | `IrregularForms` | Heading/value omitted when empty |
| Pronunciation tip: Native English | `NativePronunciation` | Back, under the official pronunciation subsection |
| Pronunciation tip: For Spanish speakers | `SpanishPronunciation` | Back, under the official pronunciation subsection |
| More examples | `Example1` through `Example5` | Four or five examples; unused fifth slot omitted |
| Common collocations/chunks | `Chunks` | Back, in the specified position |
| Common mistake and usage note | `UsageNote` | Back, in the specified position |
| Natural alternatives | `Alternatives` | Back, in the specified position |
| Spanish Translation | `SpanishTranslation` | Back, final teaching section |

The wording/language rules remain those in CARD_SPEC.md. This storage review neither changes the archived prompt nor validates the linguistic quality of existing imported cards.

The current audio storage fields are `AudioTarget`, `AudioFrontExample`, and `AudioExample1` through `AudioExample5`. They contain Anki sound references for selected placements and render beside the corresponding target/sentence. Empty or unselected placements contribute no replay control. They are media references, not new teaching headings. The back template does not include the front template, avoiding repeated front audio.

## Review of internal fields

| Field | Actual current use | Necessity and recommendation |
|---|---|---|
| `AvSourceId` | Saves the stable workspace card UUID. Delivery searches Anki by this field, checks note identity, and reconciles a response lost after creation. It is also the first field supplied to Anki. | **Retain.** Current duplicate prevention and reconciliation depend directly on it. Keep the identifier stable when updating a note. |
| `AvRevision` | Written from the approved workspace revision and included in the complete field comparison. No separate production reader interprets it. Revision is also in workspace approval and delivery receipts. | **Move tracking responsibility to the app in a future layout.** The current value is redundant for AV-034. A number in Anki must never establish approval of edited content. |
| `AvContentHash` | Written from the workspace content hash and included in the complete field comparison. No separate production reader uses it to validate current Anki content. The hash also exists in the workspace/receipt. | **Move tracking responsibility to the app in a future layout.** Re-read actual fields/media and compare against the delivery receipt; a copied hash alone cannot detect a manual Anki edit. |
| `AvProfileVersion` | Written from the English Coach profile version and included in the complete field comparison. AV-035 also reads and validates this marker while reconstructing supported notes. Delivery verifies its app-owned model and exact templates. | **Retain as a small compatibility marker.** It identifies the content contract when a supported note is loaded. It does not prove approval. |
| `AvContent` | At the AV-034 review, production only wrote/compared this Base64-encoded JSON copy; the sole decoder was a test. The AV-035 implementation now uses it as a legacy reconstruction candidate, accepting it only after its typed content/hash and all rendered teaching fields match the actual note and receipt. | **Remove in a future layout after replacing this legacy reconstruction path.** It can diverge from editable teaching fields; actual Anki fields and receipt comparisons remain authoritative. Base64 is encoding, not encryption. AV-037/038 must provide an equivalent validated field mapping before removal. |

All five fields are currently part of the strict model and payload checks, so deleting any one manually causes a compatibility/content mismatch. That mechanical dependency is different from a demonstrated need for five independent metadata fields.

Evidence inspected: `ankiFields` and both templates in anki-template.ts; `findSource`, `inspect`, and `model` in [delivery-service.ts](../src/server/delivery-service.ts); and references throughout `src` plus [delivery tests](../tests/unit/anki-delivery.test.ts). AV-034 currently blocks changed existing notes; the supported-note load/update workflow remains AV-035.

## Recommended smaller layout

Keep the existing teaching and audio fields. Retain only `AvSourceId` and `AvProfileVersion` as internal Anki fields. Keep original inputs, approval, revision, hashes, provider configuration, jobs, and delivery receipts in app-owned storage. Never infer approval solely from metadata read from Anki.

The editor should put teaching fields first for human use and internal fields last where feasible. However, `AvSourceId` is currently the first note field, which also participates in Anki duplicate handling. Moving it requires verifying duplicate behavior and preserving the stable-identity guard; it is not a cosmetic reorder to apply silently. The current Browser sort field is already `Target`.

This recommendation is not permission to change the existing note type in place. Anki note-type layout version, English Coach profile version, and application revision serve different purposes and must remain distinct.

## Compatibility work required before a change

1. Define the revised model version and its field mapping, while continuing to recognize the existing layout. Decide explicitly whether new notes use the smaller model and how existing notes are migrated.
2. Preserve `AvSourceId`, Anki note/card IDs, deck placement, and scheduling. Do not delete and recreate studied notes to change their layout. If a safe in-place mapping is unavailable, leave existing notes on the old layout and report the limitation.
3. For loading/editing, read actual teaching fields and audio references, validate them, and compare against the last delivered payload. Detect unsupported layouts, external edits, and identity conflicts. Do not treat the duplicated AvContent snapshot or stored revision/hash as current content or approval.
4. Keep legacy and revised source searches/reconciliation compatible so model changes cannot create duplicates or bypass ambiguous-send protection. Update receipt/payload validation for each supported layout rather than simply relaxing all checks.
5. Verify creation, repeated delivery, restart, lost-response reconciliation, manual Anki edits, and migration of a studied disposable note. Record note/card identity and scheduling before/after. Compare card rendering and audio placement to CARD_SPEC.md.

This review makes no Anki mutations and changes no application schema or existing notes. Implementation and migration are queued as [AV-037 and AV-038](BACKLOG.md#deferred-local-web-follow-ups), respectively. They remain deferred until explicitly selected; AV-035 has not been started by this documentation review.
