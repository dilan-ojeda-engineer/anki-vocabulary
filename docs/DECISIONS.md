# Decision register

**Version:** 0.2  
**Date:** October 11, 2026

Record meaningful product/architecture choices with their status, reason, alternatives, and evidence. `Confirmed requirement` comes from user decisions; `Proposed` is a recommendation; `Pending` still needs a decision or experiment. A confirmed requirement does not establish that its implementation works.

| ID | Decision | Status | Reason / alternatives | Evidence or next action |
|---|---|---|---|---|
| DEC-001 | Dilan, Bulma, and Trunks, all full-stack developers, with assigned tasks and peer review | Confirmed team and requirement | Enables ownership and collaboration; role hats stay within the small team | Confirm availability, coordinating roles, and proposed task distribution in AV-001 |
| DEC-002 | Kanban flow with weekly planning/demo, WIP limits, and small PRs | Proposed | Fits uncertain integration work and potentially part-time availability; a formal Scrum cadence can be reconsidered if the team prefers it | Confirm the working agreement at kickoff; review flow after two weeks of development |
| DEC-003 | GitHub repository/Issues/Projects/Actions | Proposed | Keeps task, review, and build evidence together; another shared Git host/board is acceptable | Choose hosting/visibility, inspect account features/budget, then configure AV-002 |
| DEC-004 | TypeScript application with React/Electron and modular adapters | Proposed implementation; TypeScript ecosystem is a confirmed preference | Supports desktop/local integrations and reusable core; packaging has native/runtime tradeoffs | AV-002/008 validate repeatable setup and Windows packaging |
| DEC-005 | Groq with GPT-OSS 120B for the first text-model experiment | Proposed, not selected | Candidate supports structured output and a quota-limited free workflow; alternatives should be evaluated if quality/capacity fails | Record account access and model choice before AV-005; evaluate actual learning output |
| DEC-006 | ElevenLabs hosted speech plus one local engine | Confirmed requirement; Piper is proposed local engine | Offers hosted voice choice and offline synthesis; Piper adds an external runtime | AV-006/007 evaluate both; clarify no-extra-Python requirement if requested |
| DEC-007 | Existing Anki deck selection and direct AnkiConnect delivery; retain package export | Confirmed workflow; adapter/library compatibility unverified | Direct selection meets the requested workflow; export supports portability | AV-004/008 test identities, repeated delivery, updates, and media |
| DEC-008 | Explicit approval of exact revisions before audio/delivery | Confirmed requirement | Human review is needed for AI content; edits invalidate stale approval | AV-013/016 enforce and demonstrate the rule |
| DEC-009 | Built-in English Coach initially; custom prompts/layouts later through profiles | Confirmed roadmap and initial content requirement | Preserves requested fields while allowing future user-defined structures | AV-003 tests generic boundaries; AV-026 implements the future editor |
| DEC-010 | Future hosted web phase; isolate desktop dependencies now | Confirmed roadmap | Reuses core logic; auth, storage, hosting, and local Anki access need separate design | AV-027 scoped after desktop evidence; no web infrastructure in MVP |
| DEC-011 | Free generation only; pause on quotas without paid/provider fallback | Confirmed constraint | Avoids unapproved generation charges; free capacity is limited and account-specific | Prototype records consumption and failure behavior; owner checks account billing settings |
| DEC-012 | Same-mode identity guarantees first; block unresolved cross-mode repeat delivery | Proposed implementation constraint | Direct-created Anki identities and package GUIDs may differ; a shared app ID alone cannot guarantee merge behavior | AV-004/008/021 establish and test the allowed behavior |
| DEC-013 | Narrow first integrated demonstration to P01–P05, English Coach, hosted speech, and direct Anki delivery | Recorded experiment plan; provisional provider/layout/voice settings remain open | Allows one complete path to establish integration behavior; Piper/export still receive early feasibility experiments and remain release requirements | Configuration, open-item owners, and AP-01–AP-13 in PROTOTYPE_PLAN.md; no experiment run yet |
| DEC-014 | Separate raw AI quality, structural validity, manual corrections, and final card approval | Recorded evaluation approach; reference expectations need human review | Makes linguistic problems visible rather than hiding them behind schema validity or hand-edited cards | AI_EVALUATION.md supplies 13 learning cases and seven pipeline fixtures; AV-005 executes and records evidence |
| DEC-015 | Explicit task-ID assignment to coding assistants, shared AGENTS.md guidance, and reusable handoff prompts | Documentation established; real session loading and team execution unverified | Keeps separate sessions aligned with scoped work and shared evidence; no automatic backlog dispatcher | AGENTS.md and AI_TASK_WORKFLOW.md exist; each developer verifies loaded context and chooses a Ready task |

## Prototype configuration and unresolved choices

[PROTOTYPE_PLAN.md](PROTOTYPE_PLAN.md#proposed-experiment-configuration) records the proposed first-run settings, with [open items and proposed owners](PROTOTYPE_PLAN.md#open-items-and-ownership). [AI_EVALUATION.md](AI_EVALUATION.md) records fixed input and expected behavior without claiming human-reviewed ground truth.

The user's instruction to proceed authorized this readiness-document pass. It does not establish human role appointments, account access, a confirmed production provider, a selected voice, or passing compatibility tests. Keep pending statuses until the relevant choice/evidence is actually recorded; independent fixture/skeleton work can proceed without every later release decision being settled.

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
