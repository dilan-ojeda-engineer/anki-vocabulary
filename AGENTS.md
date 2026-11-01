# Project instructions for coding assistants

## Task and context

- Implement the task explicitly assigned by the user, normally an `AV-...` ID. Do not choose or start the next backlog task automatically. Ordinary questions and documentation requests need no invented task ID.
- Read that task's scope, dependencies, and acceptance criteria in [docs/BACKLOG.md](docs/BACKLOG.md), or the linked live issue once a tracker is adopted. If issue and document disagree, identify the conflict and follow the user's current authorized direction.
- Read only the relevant specifications and code. Use [docs/PROJECT.md](docs/PROJECT.md) for architecture, [docs/CARD_SPEC.md](docs/CARD_SPEC.md) for English Coach, and [docs/PROTOTYPE_PLAN.md](docs/PROTOTYPE_PLAN.md) / [docs/AI_EVALUATION.md](docs/AI_EVALUATION.md) for prototype evidence. Do not reread every document before each edit.
- Check prerequisites against actual files/results, not the existence of a backlog row. Use agreed fixtures or perform independent in-scope work when possible; report missing dependencies rather than claiming integration works.
- Explain intended material changes before editing, then proceed within the authorized scope. Ask for clarification only when a missing decision prevents safe progress; do not require repeated approval for already authorized work.

## Implementation boundaries

- Keep custom application code in strict TypeScript, React UI in `.tsx`, and styling in CSS. Piper is an external speech dependency, not a Python application backend.
- Preserve the renderer/preload/main/worker separation: React receives typed application commands and has no direct database, Node, filesystem, or decrypted-key access. Validate process boundaries and provider output at runtime.
- Keep profiles, approval, jobs, providers, and delivery modular. Implement only the assigned phase; preserve future web/custom-profile boundaries without adding their infrastructure/editor now.
- Preserve the archived user prompt. English Coach fields/headings belong to that profile, not every future profile.
- Enforce exact-revision approval outside the UI before audio or Anki delivery. Content edits clear approval; reuse audio only on exact valid cache matches.
- Persist stable source-note identity and per-item delivery receipts. Reconcile ambiguous Anki creation before retrying; update studied notes without deleting/recreating them. Block unresolved collection or cross-mode identity reuse.
- Keep credentials out of Git, logs, learning cards, and backups. Use fake providers in ordinary tests and disposable Anki profiles for integration work. Real provider calls use the account owner's authorized free allowance; no silent paid/provider fallback.

## Collaboration and validation

- Follow [CONTRIBUTING.md](CONTRIBUTING.md). Work in the assigned checkout/branch when Git exists; preserve unrelated edits. Coordinate shared contracts and migrations through the task instead of overwriting another developer's work.
- Run checks appropriate to the change using scripts that actually exist. Planned commands in the docs are not executable yet; report unavailable checks. Verify documentation links/content for documentation-only work.
- Record actual outcomes and distinguish fake-provider checks, real integration evidence, linguistic review, and unrun scenarios. Do not claim tests passed, quality was reviewed, or a dependency was validated without evidence.
- End with the task/outcome, changes, checks/results, acceptance gaps, and follow-ups. A result prepared for peer review is not automatically Done; a human owner/reviewer manages board status and acceptance.
- Do not merge, publish, or send messages to teammates unless authorized for that action. Do not claim a proposed assignment has been accepted by its human owner.

Reusable assignment, review, and resume prompts are in [docs/AI_TASK_WORKFLOW.md](docs/AI_TASK_WORKFLOW.md). This file supplies shared rules; the user's task prompt selects the current work.
