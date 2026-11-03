# Decision register

**Version:** 0.2  
**Date:** October 11, 2026

Record meaningful product/architecture choices with their status, reason, alternatives, and evidence. `Confirmed requirement` comes from user decisions; `Proposed` is a recommendation; `Pending` still needs a decision or experiment. A confirmed requirement does not establish that its implementation works.

| ID | Decision | Status | Reason / alternatives | Evidence or next action |
|---|---|---|---|---|
| DEC-001 | Dilan, Bulma, and Trunks, all full-stack developers, with assigned tasks and peer review | Confirmed team and requirement | Enables ownership and collaboration; role hats stay within the small team | Confirm availability, coordinating roles, and proposed task distribution in AV-001 |
| DEC-002 | Kanban flow with weekly planning/demo, WIP limits, and small PRs | Proposed | Fits uncertain integration work and potentially part-time availability; a formal Scrum cadence can be reconsidered if the team prefers it | Confirm the working agreement at kickoff; review flow after two weeks of development |
| DEC-003 | GitHub repository/Issues/Projects/Actions | Proposed | Keeps task, review, and build evidence together; another shared Git host/board is acceptable | Choose hosting/visibility, inspect account features/budget, then configure AV-002 |
| DEC-004 | TypeScript application with React/Electron and modular adapters | Electron-first implementation superseded by DEC-025; TypeScript/React preference retained | Supported desktop/local integrations and reusable core; the local web direction removes Electron from the first shell | Preserve AV-002 evidence and migrate reusable code only after the local web plan is decomposed |
| DEC-005 | Groq with GPT-OSS 120B for the first text-model experiment | Experiment selection completed; no production adoption, superseded for provider selection by DEC-024 | Candidate supports structured output and a quota-limited free workflow; alternatives were evaluated after quality/capacity issues | AV-005 records actual quality, usage, and quota behavior |
| DEC-006 | ElevenLabs hosted speech plus one local engine | Earlier desktop requirement superseded for the first local web slice by DEC-025; initial provider/voice unresolved | Offered hosted voice choice and offline synthesis but expanded setup and release scope | Select and listen to one initial provider/voice before real audio implementation |
| DEC-007 | Existing Anki deck selection and direct AnkiConnect delivery; retain package export | Direct delivery retained by DEC-025; package export deferred | Direct selection meets the requested workflow; export is not needed for the first local slice | Reuse AV-004 identity/update evidence; revisit export only after the local workflow works |
| DEC-008 | Explicit approval of exact revisions before audio/delivery | Confirmed requirement | Human review is needed for AI content; edits invalidate stale approval | AV-013/016 enforce and demonstrate the rule |
| DEC-009 | Built-in English Coach initially; custom prompts/layouts later through profiles | Confirmed roadmap and initial content requirement | Preserves requested fields while allowing future user-defined structures | AV-003 tests generic boundaries; AV-026 implements the future editor |
| DEC-010 | Future hosted web phase; isolate desktop dependencies now | Hosted phase deferred; DEC-025 selects a local browser interface instead | Hosted auth, storage, budget, and local Anki access remain a separate product decision | No hosted infrastructure in the local web phase |
| DEC-011 | Free generation only; pause on quotas without paid/provider fallback | Confirmed constraint | Avoids unapproved generation charges; free capacity is limited and account-specific | Prototype records consumption and failure behavior; owner checks account billing settings |
| DEC-012 | Same-mode identity guarantees first; block unresolved cross-mode repeat delivery | Proposed implementation constraint | Direct-created Anki identities and package GUIDs may differ; a shared app ID alone cannot guarantee merge behavior | AV-004/008/021 establish and test the allowed behavior |
| DEC-013 | Narrow first integrated demonstration to P01–P05, English Coach, hosted speech, and direct Anki delivery | Historical desktop experiment plan; superseded for the next vertical slice by DEC-025 | Established useful acceptance concepts, but Piper/export and text generation are no longer prerequisites for the first local web workflow | Migrate relevant scenarios into LOCAL_WEB_PLAN.md; preserve PROTOTYPE_PLAN.md as history |
| DEC-014 | Separate raw AI quality, structural validity, manual corrections, and final card approval | Recorded evaluation approach; reference expectations need human review | Makes linguistic problems visible rather than hiding them behind schema validity or hand-edited cards | AI_EVALUATION.md supplies 13 learning cases and seven pipeline fixtures; AV-005 executes and records evidence |
| DEC-015 | Explicit task-ID assignment to coding assistants, shared AGENTS.md guidance, and reusable handoff prompts | Documentation established; real session loading and team execution unverified | Keeps separate sessions aligned with scoped work and shared evidence; no automatic backlog dispatcher | AGENTS.md and AI_TASK_WORKFLOW.md exist; each developer verifies loaded context and chooses a Ready task |

## Package manager — November 1, 2026

DEC-016: Use npm and `package-lock.json` for AV-002 and subsequent development. Accepted through the user's explicit instruction to switch from pnpm. npm is bundled with the selected Node.js runtime and avoids a separate package-manager installation. This supersedes the original pnpm tooling recommendation; it does not change the application architecture. Pin npm in `package.json`, use `npm ci` for onboarding/CI, and run the same foundation checks after migration. The earlier pnpm runs remain historical evidence in [DEVELOPMENT.md](DEVELOPMENT.md); npm validation is recorded separately there. No automated release publication is enabled.

## Prototype configuration and unresolved choices

### DEC-017 — AnkiConnect protocol for the feasibility adapter

On November 1, 2026, AV-004 selected JSON-RPC API v1 for its new TypeScript probe after inspecting official upstream source `c577b44aaadbd72dbc22c823f874a126213fe5c5` and querying the actual isolated runtime. The current upstream recommends v1 for new clients; explicit collection-session guards and operation handles support the required recovery checks. Legacy API 6 remains an untested alternative. This is an experiment decision, not a promise to support all add-on versions or a completed production delivery adapter.

The tested Anki runtime was 26.09.3; the add-on's documented minimum is 26.08. The captured runtime contract matched reference `c577b44`, while a later on-disk source audit matched `760ff48`; those are recorded separately rather than claiming a permanent source pin. String IDs are converted to AV-003 numeric IDs only when safe. Persistent collection identity is not inferred from a profile name: current pairing is session-bound and blocks after session changes. [ANKI_FEASIBILITY.md](ANKI_FEASIBILITY.md) records the real results, simulated failures, source provisioning, and follow-ups. AV-015/AV-021 must revisit persistent re-pairing, concurrency, independent edits, and cross-mode compatibility before production use.

[PROTOTYPE_PLAN.md](PROTOTYPE_PLAN.md#proposed-experiment-configuration) records the proposed first-run settings, with [open items and proposed owners](PROTOTYPE_PLAN.md#open-items-and-ownership). [AI_EVALUATION.md](AI_EVALUATION.md) records fixed input and expected behavior without claiming human-reviewed ground truth.

The user's instruction to proceed authorized this readiness-document pass. It does not establish human role appointments, account access, a confirmed production provider, a selected voice, or passing compatibility tests. Keep pending statuses until the relevant choice/evidence is actually recorded; independent fixture/skeleton work can proceed without every later release decision being settled.

### DEC-018 — English Coach example count and AV-005 prompt

On November 1, 2026, the owner explicitly chose 4–5 additional examples, four by default and a fifth only when useful, after being shown the conflict between the new attachment's main rule and the earlier 3–4 project interpretation. This supersedes that earlier count for AV-005 onward; historical prompt archives and AV-003 fixtures stay unchanged. The versioned `av005-1` profile/adaptation preserves the new attachment's teaching guidance, uses nullable irregular forms in JSON, and leaves display headings to the profile layout. The historical front/examples-only audio plan implied five clips per default card or six with a fifth example; DEC-025 supersedes that audio count for the local web direction by adding target audio. No audio integration was implemented by this decision. See [TEXT_FEASIBILITY.md](TEXT_FEASIBILITY.md).

### DEC-019 — English-only learning content

On November 2, 2026, the owner explicitly removed Spanish from the cards. Current profile/prompt `av005-3` therefore omits the Spanish pronunciation and translation fields and their layout entries; explanations, correction reasons, examples, and pronunciation guidance are English only, with IPA retained. This supersedes the archived prompt's bilingual requirements for current output. Earlier prompt/profile snapshots and real run evidence stay unchanged. The new layout has its own note-type key/version; this does not migrate existing Anki notes. See [CARD_SPEC.md](CARD_SPEC.md) and [the English-only prompt](prompts/english-coach-av005-3.md).

### DEC-020 — Audience-specific pronunciation guidance remains in English

The owner clarified on November 2, 2026 that the Spanish-speaker pronunciation tips were missing. The English-only instruction concerns the language of the content, not removal of that teaching support. This corrects the overly broad subsection removal recorded in DEC-019. Current profile/prompt av005-4 includes both Native English and For Spanish speakers guidance, entirely in English with IPA, and excludes Spanish translations. Historical v3 and earlier evidence remain unchanged. The new layout uses its own note-type key/version; no existing Anki collection migration or new provider validation is implied.

### DEC-021 — Preserve the complete official card structure

On November 2, 2026, the owner explicitly confirmed that Spanish Translation stays because it is part of the prompt. This resolves the language/structure ambiguity and supersedes the translation removal in DEC-019/DEC-020. Current av005-5 preserves every official heading in order, omitting only Irregular Forms when inapplicable. All explanations and both pronunciation subsections are in English; contextual Spanish appears only in Spanish Translation. A contract test locks the complete heading sequence and required translation field. Earlier versions/evidence remain unchanged; no real av005-5 response or Anki migration is implied.

### DEC-022 — Explicit Qwen comparison without automatic fallback

On November 2, 2026, the owner authorized a comparison of Groq Qwen 3.8 27B against GPT-OSS 120B using the unchanged av005-5 prompt, strict schema, fixed inputs, and request settings. The experiment runner accepts only explicit allowlisted model IDs and records the selected model; its historical default remains GPT-OSS. The [actual comparison](evidence/AV-005-qwen-comparison.md) completed two cases and stopped after a repeated rate-limit rejection on P03. Qwen is not adopted: the comparison is incomplete and available cards still have teaching defects. This does not authorize paid/provider fallback or imply production model selection.

### DEC-023 — Explicit Gemini feasibility comparison

On November 2, 2026, the owner selected Gemini after the incomplete Groq comparison, configured a local key, and reported the associated project's Free tier. This authorizes the explicit native Gemini `gemini-3.8-flash` experiment with the unchanged av005-5 prompt; it does not adopt a production provider or authorize paid fallback. The adapter records native settings/usage and its transport schema separately from canonical local validation. The [experiment report](TEXT_FEASIBILITY.md#gemini-configuration) records access, checks, actual outcomes, and pending learning acceptance. Groq evidence remains preserved.

### DEC-024 — Pause AV-005 without adopting a text provider

On November 2, 2026, the owner paused AV-005 and chose to preserve its code, prompts, raw evidence, and editorial candidates as an inconclusive feasibility record. Groq GPT-OSS produced structurally valid cards with substantive learning defects; the Qwen comparison remained incomplete after rate limits; Gemini generation returned service-unavailable diagnostics and no cards. None is adopted for production, and no generated or manually edited card is automatically approved. This decision closes the current experiment checkpoint without claiming product acceptance. A future project-direction decision may reuse the profile, validation, evaluation cases, provider boundaries, and Anki evidence while selecting a different workflow or provider.

### DEC-025 — Local web Anki Card and Audio Workspace

On November 2, 2026, the owner accepted a local web tool in the existing repository as the new first application direction. A loopback Node service and React browser interface replace Electron as the planned first shell; the existing Electron scaffold remains until reusable code is extracted and the new vertical slice works. The accepted initial workflow selects any existing destination deck, pastes/imports English Coach cards or loads supported notes, reviews and edits cards individually, previews both sides, generates and listens to audio one item or all missing items at a time, and safely creates or updates Anki notes. English Coach audio selection now includes the target plus the front and additional examples. Existing audio replacement uses a new file and an in-place note update that preserves identity and scheduling. Arbitrary note-type mapping, general Audio Studio behavior, provider selection, package export, automatic media deletion, and hosted deployment remain deferred. See [LOCAL_WEB_PLAN.md](LOCAL_WEB_PLAN.md).

### DEC-026 — Prepare cards offline and connect to Anki for delivery

On November 2, 2026, after seeing the read-only foundation, the owner accepted an offline preparation workflow. The local browser and Node server may import, save, review, approve, and prepare audio while Anki Desktop is closed. A server-owned, versioned workspace outside the repository retains pending source text, revisions, approvals, audio references, and delivery state across browser/server restarts. AV-029 chooses the concrete store and proves recovery. Audio generated by a hosted provider can still require internet and an authorized allowance. AnkiConnect remains necessary for live deck discovery, loading supported notes, and delivery. Reconnection does not authorize automatic sending: the user chooses a current deck and explicitly confirms the reviewed work before the server revalidates and writes. Anki package export remains deferred. See [LOCAL_WEB_PLAN.md](LOCAL_WEB_PLAN.md) and AV-029 through AV-036 in [BACKLOG.md](BACKLOG.md).

### DEC-027 — ElevenLabs first, then Fish Audio

On November 3, 2026, the owner selected ElevenLabs as the first speech provider for AV-033 and Fish Audio as the next provider to add. This resolves the initial provider choice deferred by DEC-025; it does not select a voice/model, confirm an account allowance, or validate speech quality. The owner will configure the ElevenLabs key locally and confirm available free allowance. Use an account-available American English voice after a listening check. Fish Audio remains a later integration through the shared adapter; this decision does not authorize automatic provider fallback. Piper remains deferred.

### DEC-028 — Sarah initially; selectable voices and voice groups later

On November 3, 2026, after receiving the River and Sarah listening samples, the owner chose Sarah for initial AV-033 use. The initial configuration is voice `EXAVITQu4vr4xnSDxMaL`, model `eleven_multilingual_v2`, normal speed, and `mp3_44100_128`, matching the listening sample. This records the owner's initial voice choice, not acceptance of all generated learning audio.

The owner also requested future selection of any account-available supported voice or a group of voices. Record this as future scope alongside Fish Audio; it is not part of the initial single-voice AV-033 implementation. Group membership, assignment to cards or placements, and any rotation rules remain design decisions for that future feature. Each generated clip must retain its actual provider, voice, model, and settings for exact cache matching and playback comparison.

## Lightweight architecture decision format

For a consequential decision that needs more detail, add a short record here or a linked document:

```text
ID and title:
Status: proposed / accepted / superseded
Decision owner and date:
Context and constraints:
Options considered:
Decision and reason:
Tradeoffs and future implications:
Evidence or experiment required:
Revisit when:
Supersedes / superseded by:
```

Do not silently overwrite accepted history when a choice changes. Record the new decision and link the superseded one. Product decisions belong to the named product owner; technical decisions are coordinated by the named human lead and reviewed by the team. Codex recommendations remain proposals until adopted or authorized in context.
