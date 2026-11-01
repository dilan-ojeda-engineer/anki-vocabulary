# Team organization and software delivery

**Version:** 0.1  
**Date:** October 11, 2026  
**Team:** Three human developers  
**Status:** Proposed working agreement and delivery process. No remote repository, issue board, CI, or release has been configured.

## 1. Recommended methodology

Use iterative development with a Kanban board, weekly planning, and a weekly demonstration. Start with experiments that resolve technical risks, then deliver small working additions to the application. This is a project-specific recommendation, not a claim that one methodology is best for every team.

The weekly cadence is a coordination rhythm, not a promise to finish a fixed set of tickets every week. Agree actual availability before making commitments. Ship when the milestone's acceptance criteria pass. Keep future web hosting and the custom-profile editor in later milestones while preserving the interfaces they need now.

Use one repository, one shared backlog, and one integrated main branch. Build features across their UI, processing, and persistence boundaries; avoid finishing three disconnected layers and integrating only at the end.

## 2. People and responsibilities

The application audience and the development team are separate concepts. Three people building the software does not change the confirmed personal-installation and personal-credential model.

The confirmed developers are **Dilan, Bulma, and Trunks**, all full-stack developers. Task ownership below is an initial proposal using those names; weekly availability and acceptance of the distribution remain to be recorded. Assign product-owner and technical-coordinator responsibilities to people; those roles may be held by members of the three-person team.

| Responsibility | Accountable person | Decisions and outputs |
|---|---|---|
| Product owner | Dilan proposed; appointment to confirm | Learning usefulness, priorities, visible card layout, MVP scope, pilot acceptance |
| Technical coordinator | One of Dilan/Bulma/Trunks, to be named | Shared contracts, architecture decisions, integration order, technical release readiness |
| Feature implementer | One owner per backlog item | Implementation, appropriate tests, documentation, demo, and evidence |
| Peer reviewer | A different developer per item | Correctness, acceptance criteria, maintainability, and relevant security/data risks |
| Release coordinator | Rotate among Dilan, Bulma, and Trunks by milestone | Candidate build, release checklist, artifact provenance, and support handover |

Codex or another coding assistant can help a developer implement or review a task. The human task owner remains responsible for understanding the change and its evidence; generated code does not replace peer approval.

Initial areas of familiarity:

| Developer | Initial emphasis | Default reviewer |
|---|---|---|
| Dilan | Input, review/editor UI, accessibility, integration demo; initial Piper/packaging experiments | Bulma |
| Bulma | Profiles, validation, text generation, approval/revision rules, persistence and credential settings | Trunks |
| Trunks | Anki delivery, speech adapters, package export, Windows release packaging | Dilan |

These are starting areas, not exclusive ownership or assumptions about specialization. Rotate tasks and pair on unfamiliar integrations. To distribute integration work, Dilan initially owns Piper/packaging feasibility and Bulma owns credential settings, with Trunks reviewing those platform boundaries. Rebalance using availability and actual effort. Every developer writes tests and handles defects in their changes; there is no separate testing-only developer.

## 3. Work board and assignment rules

Recommended tools: GitHub repository, Issues, Projects, pull requests, and Actions. Hosting/visibility and account details are pending; this document does not create an external project. [Projects supports issue/PR tracking and custom planning views](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects).

Use these states:

`Backlog → Ready → In progress → Review → Validate → Done`

- **Backlog:** identified work that needs refinement or has unresolved dependencies.
- **Ready:** scope, owner, acceptance criteria, and prerequisites are clear.
- **In progress:** one developer is actively implementing or running the experiment.
- **Review:** a pull request or experiment report is ready for a peer.
- **Validate:** peer review/checks passed; relevant acceptance evidence or user demonstration remains.
- **Done:** required evidence is attached and the change is merged. Release status is tracked separately.

Initial work-in-progress policy: one active implementation item per developer, at most three in progress, two waiting in review, and five total items across In progress/Review/Validate. Blocked items count toward the limit. Any deliberate exception needs a recorded reason; pausing an item does not reset its start date or erase its age. When a limit is reached, help review, validate, or unblock work before starting more. Adjust the limits using observed flow.

Record `blocked` as a flag with reason, dependency, next action, and an owner. Product-priority changes come from the product owner; implementation-order changes are coordinated with the team. Do not assign new work to someone without checking capacity.

Every item needs an ID, outcome, priority, milestone, one owner, reviewer, dependencies, acceptance criteria, and relevant risk/test notes. Record a target date only after availability and dependencies make it credible. Keep issue status current; chat messages alone are not the record of a decision.

The initial task inventory and proposed owners are in [BACKLOG.md](BACKLOG.md). Once a remote board is adopted, issues become the live task record; the Markdown backlog remains the initial baseline and links to issues instead of becoming a second competing tracker.

For prototype refinement, use [PROTOTYPE_PLAN.md](PROTOTYPE_PLAN.md) for configuration/open items and [AI_EVALUATION.md](AI_EVALUATION.md) for fixed inputs and learning expectations. The readiness documents are prepared; human review, actual tooling, and experiment evidence remain pending.

## 4. Team cadence

| Event | Initial cadence | Outcome |
|---|---|---|
| Planning/refinement | Weekly, about 30 minutes | Prioritized Ready items, capacity-aware assignments, dependency review |
| Progress update | On a working day, asynchronous | What moved, next action, blockers needing another person |
| Integration/pairing | As needed; reserve time before the demo | Resolve shared interfaces and run the integrated application |
| Demonstration | Weekly, about 30 minutes | Show working behavior and collect product feedback |
| Retrospective | Every two weeks, about 20 minutes | Choose one practical process improvement and its owner |

Adjust this cadence for a part-time team. Try to provide an initial PR response on the next working day; this is a working agreement to confirm, not an assumed availability commitment.

## 5. From discovery to delivery

| Phase | Main work | Evidence to move forward |
|---|---|---|
| 0. Team kickoff | Name people/roles, confirm availability, prioritize scope, choose repository hosting, refine first tasks | Named ownership, agreed workflow, first Ready items, recorded provisional choices |
| 1. Engineering foundation | Git, repeatable setup, strict TypeScript, formatting, baseline CI, app skeleton, shared contracts | Each developer builds/runs the same skeleton; checks run without provider keys |
| 2. Technical feasibility | Text quality, quota behavior, both speech paths, Anki identity/recovery, Windows packaging/export | Experiment reports with results, limitations, and adopted/rejected decisions |
| 3. Five-word workflow | Input → draft → review/approval → audio → chosen Anki deck | Real end-to-end demonstration in a disposable Anki test profile |
| 4. MVP completion | 50-item workflow, editing/regeneration, persistence, progress, direct delivery and package export | Product acceptance scenarios and approved representative cards |
| 5. Reliability and pilot | Restart/retry, duplicates, backup/restore, credentials, clean Windows install, actual mobile playback | Release checklist passes; another person completes setup and study |
| 6. Release and support | Versioned artifact, setup guide, notices, release notes, known limitations, issue triage | Traceable release, product acceptance, recovery/support instructions |

Build the first integrated path with one speech provider, then add the second confirmed provider and package export. Both speech integrations and both delivery paths remain requirements before the first release; sequencing does not remove them.

Feasibility experiments have a narrow question and stop condition. For example: can we recover an ambiguous Anki insertion without duplicating the note? Produce executable evidence where needed; an experiment that fails is useful when it records why and the resulting design decision. Avoid polishing interfaces before the underlying assumption is tested.

Dates and delivery estimates follow the first experiments and team-availability confirmation. Work in small increments and revise forecasts as uncertainty decreases.

## 6. Ready and Done

A task is **Ready** when its user/technical outcome is clear, criteria are checkable, dependencies are satisfied or explicitly isolated with a fake adapter, and its owner/reviewer are named. Break large work into smaller outcomes; do not require exhaustive design before an experiment starts.

A task is **Done** when:

- Its agreed criteria pass, with test or manual evidence appropriate to the change.
- Code changes have passing relevant type/lint/test/build checks and a peer review.
- Shared interface changes are integrated with callers; temporary fake behavior is explicitly identified.
- Required docs and migration/recovery notes are updated; secrets and private provider data are absent from artifacts.
- The pull request is merged and the issue links to the evidence.

Documentation-only changes require accurate content and link checks; do not add meaningless code tests. A feasibility report is Done when its question is answered and the decision is recorded, even if the candidate fails. Feature Done does not mean the entire application is released.

## 7. Architecture and integration technique

Keep the agreed single-application architecture. Use small modules around responsibilities: profiles/validation, drafts/approval, jobs/storage, text adapters, speech adapters, Anki delivery, and desktop transport. React depends on typed application commands; provider and desktop details stay behind adapters.

Define the minimal shared contracts and fixtures early, owned initially by Bulma and reviewed by Dilan/Trunks. Dilan can develop previews against fake drafts while Bulma implements generation and Trunks proves delivery. Merge contract changes first, then update consumers; do not let each developer invent a different `CardDraft` or approval state.

Use stable source-note identity, exact revision approval, and durable per-item delivery receipts from the beginning. A provider request is not part of a database transaction. Handle interrupted external operations through reconciliation, and serialize the critical create/check sequence in the worker to avoid duplicate concurrent insertions.

Assign each database migration to one issue. Keep migrations ordered, review data preservation, and verify upgrades with a backup. Isolate per-developer app data and Anki test profiles so parallel work cannot overwrite a teammate's collection.

Record consequential choices in [DECISIONS.md](DECISIONS.md), including alternatives, reasons, status, and evidence. Ordinary variable names and routine implementation details do not need architecture decision records.

## 8. Git, peer review, and continuous integration

Use the [Git conventions in CONTRIBUTING.md](../CONTRIBUTING.md#git-conventions) as the source for branch names, Conventional Commits, application Semantic Versioning, and release tags. Local Git is initialized; remote controls and automated enforcement remain pending.

Use short-lived task branches and small pull requests into `main`; keep `main` buildable. Avoid a separate long-lived branch per developer or separate permanent frontend/backend integration branches. Use draft PRs early to expose shared-contract changes.

Require one approval from a different developer and passing configured checks before merge. Risky identity, credential, or migration changes also need review from the person familiar with that area; one qualified reviewer may satisfy both requirements. Squash merge focused PRs and record the issue reference.

Enable branch protection where the chosen hosting plan supports it. GitHub's private-repository protection availability depends on the plan; confirm it before adopting automatic enforcement. If unavailable, use the same team review policy and document that enforcement is manual. [GitHub protection capabilities and availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

Set up CI incrementally during foundation work: type checks, lint, focused tests, and a build. Add packaged Windows checks once packaging exists. Fake providers run in ordinary PR checks; real-provider tests are explicit and use the account owner's available allowance. Review Actions usage/budget before enabling frequent Windows builds.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for issue/PR templates and day-to-day contribution steps.

## 9. Quality and release responsibility

Each implementer provides checks for their behavior; peers review the evidence. The product owner judges learning usefulness and card readability. Software testing does not establish that IPA, translations, or every usage example is linguistically correct; use a reviewed evaluation set and obtain linguistic help when needed.

Test three levels: core behavior with fake providers, adapter/integration behavior with controlled fixtures, and complete desktop/Anki behavior with real test profiles. Prioritize invalid approval, stale revisions, interrupted sends, scheduling preservation, quota handling, and restore. Re-test the Windows package after dependency/runtime changes.

Before a pilot/release:

- Build from a reviewed commit and record version, commit, dependencies, supported Windows/Anki versions, and artifact checksums.
- Run the 50-item workflow, same-mode repeat delivery, update of a studied note, restart/recovery, and backup/restore scenarios.
- Confirm direct deck selection and package import separately; disclose the cross-mode identity restriction until reconciliation is tested.
- Verify both speech paths and audio playback after mobile media sync on the actual chosen clients.
- Verify clean-machine setup, native/WASM assets, engine/voice setup, credential exclusion, and applicable license/attribution notices.
- Publish setup/troubleshooting instructions, known limitations, release notes, and a support contact/issue route. Decide signing/distribution costs before wider release.
- Have the product owner accept the pilot behavior and the release coordinator record the evidence. No open defect involving data loss, duplicate insertion, approval bypass, or credential exposure may be waived for release.

Continuous integration validates each change; desktop delivery is a deliberate, versioned release. No automatic publication is assumed. Publishing a release is a separate task assigned to the release coordinator.

For a bad release, stop distribution and retain the last known-good artifact. Back up user data before repair. An older executable may not understand an upgraded database: verify downgrade compatibility or restore a compatible backup; do not overwrite current data as an improvised rollback.

After release, triage reported defects, reproduce in a test workspace, prioritize data/security failures, and ship reviewed fixes. Rotate triage responsibility among the three developers and document dependency/provider compatibility changes.

## 10. Improvement and change control

Track started/finished dates, active-item count, unfinished-item age, completed items per week, and cycle time. Use these lightweight board records to spot blocked work and review delays; agree an initial expected completion window at kickoff based on availability, then refine it from observed cycle times. Also track defects escaping into the pilot and whether learners complete the workflow. Measure generation latency, quota use, and learning-content corrections during the prototype. Do not rank developers by commits or lines of code.

Once releases exist, use team-level delivery lead time, release frequency, and release failures/recovery as improvement signals. Begin with lightweight records rather than a metrics platform. [DORA emphasizes contextual measurement and small changes](https://dora.dev/guides/dora-metrics/).

For a new request, record the outcome, effect on the current milestone, dependencies, and proposed tradeoff. The product owner decides priority; the technical coordinator records architecture/release implications. Reassign or defer work explicitly instead of hiding added scope in an existing ticket.

## References and status

- [The Kanban Guide](https://kanbanguides.org/the-kanban-guide/2025.5/) informs workflow visibility, WIP controls, and flow improvement. The specific limits and cadence above are proposed team policies.
- [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects) and [protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
- [DORA delivery metrics](https://dora.dev/guides/dora-metrics/).

Sources reviewed October 11, 2026. Developer names/full-stack background are confirmed. Availability, role appointments, proposed assignment acceptance, hosting, and actual tool configuration remain pending. This playbook prepares the working process; it does not claim that controls or integrations have been implemented.
