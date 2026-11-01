# Contributing as a three-person team

**Status:** Working agreement proposed October 11, 2026. Local Git and the AV-002 application scaffold are established. Git conventions were recorded November 1, 2026. Local check scripts and a Windows workflow are prepared; remote hosting, remote CI execution, and branch protection remain unconfigured. See [development setup and evidence](docs/DEVELOPMENT.md).

Read [PROJECT.md](docs/PROJECT.md), [the delivery playbook](docs/DELIVERY_PLAYBOOK.md), and [the initial backlog](docs/BACKLOG.md). The playbook defines roles, Ready/Done, WIP limits, and release responsibilities. The confirmed team is Dilan, Bulma, and Trunks, all full-stack developers; the backlog proposes named owners/reviewers whose allocation is to be confirmed against availability.

## Before beginning a task

1. Choose a Ready issue with the team, confirm its human owner/reviewer, and check dependencies.
2. Agree the acceptance criteria and shared-contract changes before parallel implementations diverge.
3. Work on a short-lived branch such as `feat/AV-012-card-review` or `fix/AV-021-delivery-recovery`, using your own checkout/worktree.
4. Use your own test app data, Anki test profile, and provider accounts. Keep secrets outside Git and do not send credentials in issues or chat.

Each developer contributes working behavior, relevant checks, and documentation. Shared-domain/database changes require coordination, not exclusive ownership of an entire subsystem. Contact the contract/migration owner before modifying an interface another active task consumes.

## Git conventions

### Branching and review

Use GitHub Flow: short-lived task branches from `main`, reviewed pull requests, and squash merges back into `main`. This workflow also applies if another hosting service is selected. Keep `main` buildable and ready for a release when the milestone criteria pass. Do not add a permanent `develop` branch or permanent branches per developer.

Name branches `<type>/AV-<id>-<short-description>`, for example `feat/AV-012-card-review` or `fix/AV-021-delivery-recovery`. Documentation or maintenance without a task ID may use a descriptive name such as `docs/git-conventions`; do not invent backlog IDs.

Keep each PR focused on one outcome. Require another human developer's approval and passing configured checks before merge; record manual enforcement while remote controls are unavailable. Delete the task branch after merge. Do not rewrite shared history or force-push `main`; undo merged changes with a reviewed revert. Rebase only private task work, coordinating first if others use the branch.

### Commits

Use Conventional Commits: `<type>(<optional-scope>): <description>`. Write a short imperative description and reference the assigned task in the subject or body when applicable.

```text
feat(review): add card preview (AV-012)
fix(anki): prevent duplicate delivery (AV-021)
docs: clarify setup instructions
```

Use `feat` for new behavior, `fix` for bug fixes, `docs` for documentation, `refactor` for restructuring without behavior changes, `test` for tests, `build` for dependencies/build tooling, `ci` for automation, `chore` for maintenance, `style` for formatting, and `revert` for reversals. Mark breaking changes with `!` after the type/scope and a `BREAKING CHANGE:` footer explaining impact and migration, including during `0.x` development.

Commit a coherent change after relevant checks pass. Review the diff, stage intended files explicitly, and inspect the staged diff before committing. Preserve unrelated staged/unstaged work. Commit the lockfile with dependency changes; exclude credentials, personal data, downloaded voices, and generated artifacts. Small local commits are welcome; the squash commit and PR title must follow the same message convention and retain any breaking-change notice.

Coding assistants should flag good commit points and wait for the user's instruction before creating commits. Merging and publishing require separate authorization.

### Application versions and releases

Use Semantic Versioning, `MAJOR.MINOR.PATCH`, for application releases. Document versions such as the project brief's `0.7` describe documents, not application releases.

- Start with `0.1.0` for the first usable prototype; this version has not been released.
- During `0.x`, increment MINOR for features or breaking changes and PATCH for compatible fixes. This is the project's pre-1.0 policy; compatibility is still evolving. Document breaking changes explicitly.
- Release `1.0.0` when the desktop MVP satisfies its acceptance criteria. From `1.0.0`, increment MAJOR for incompatible changes to supported contracts, MINOR for compatible features, and PATCH for compatible fixes. Reset lower components when incrementing a higher one.
- Treat supported commands, profile/note-type formats, and import/export behavior as compatibility contracts. Record database/backup upgrade requirements and Anki compatibility in release notes; internal schema changes alone do not automatically require a major version if supported behavior and data upgrades remain compatible.
- Use release tags such as `v0.1.0` and prerelease versions/tags such as `0.1.0-rc.1` / `v0.1.0-rc.1`. Match the application manifest version once scaffolding exists. Tags identify reviewed release commits; never move a published release tag or replace its artifacts.
- Choose the version from the combined user-facing changes since the previous release. Documentation, tests, refactors, and maintenance alone do not require a release or version bump. Commit types inform release notes; they do not trigger publication.

Release notes list features, fixes, breaking changes, migration/recovery instructions, supported versions, and known limitations. Application versions, database migrations, immutable profile versions, and Anki note-type versions remain separately versioned. Review their compatibility for each release.

These conventions are currently enforced through review. Commit hooks, automated versioning/changelogs, CI, and hosting protections are not configured by this document.

## Work item format

```text
ID / title:
Outcome: what becomes possible or what question is answered?
Type: feature / defect / experiment / maintenance / documentation
Priority and milestone:
Owner and reviewer:
Dependencies and blocked reason, if any:
Scope and explicit exclusions:
Acceptance criteria:
Validation approach and relevant data/security risks:
Decision links:
Evidence and PR link:
```

Acceptance criteria describe observable outcomes, not a list of files to edit. For an experiment, state its question and the evidence needed to answer it. For a defect, include reproducible steps, expected/actual behavior, relevant versions, and sanitized logs.

Prototype issues use the [AP-01–AP-13 scenarios](docs/PROTOTYPE_PLAN.md#prototype-acceptance-scenarios) and [versioned evaluation cases](docs/AI_EVALUATION.md). Link results to case IDs, actual settings, and the tested revision. Distinguish human-reviewed expectations, raw model results, manual corrections, simulated failures, and real Anki evidence.

## Pull request format

```text
Problem and resulting behavior:
Issue: AV-...
Validation: checks run, relevant results, and manual evidence
Data/interface changes: migrations, compatibility, recovery if relevant
Known limitations or follow-up work:
```

Keep each PR focused on one reviewable outcome. Open a draft early for shared interfaces; request review when checks and acceptance evidence are ready. Another developer reviews before merge. Resolve substantive review comments and re-run affected checks after changes. Do not merge a feature whose fake/prototype behavior is being presented as real integration.

## Development and checks

AV-002 pins compatible tooling and supplies the lockfile and [Windows onboarding commands](docs/DEVELOPMENT.md). Available scripts are `npm run dev`, `npm start`, `npm run typecheck`, `npm run lint`, `npm run format`, `npm run format:check`, `npm test`, `npm run test:e2e`, `npm run build`, and `npm run check`. `npm run package:win` remains deferred to the packaging tasks. Use the recorded evidence to distinguish available commands from verified outcomes.

Ordinary tests use fake providers without network keys. Run real generation checks explicitly within the owner's available allowance. Test data/revision/retry rules meaningfully; do not add tests that only repeat implementation details or arbitrary coverage targets. Doc changes need content/link verification rather than code tests.

Use a disposable Anki profile for integration checks. Record actual Anki/add-on/runtime versions with evidence. Never use a learner's active collection for development experiments without a separate explicit agreement and a backup.

## Using coding assistants

Give the assistant the issue ID, accepted scope, relevant specifications, and acceptance criteria. Work within the task branch. Review generated changes and understand critical approval, credential, data-migration, and delivery logic before requesting peer review.

Use [AGENTS.md](AGENTS.md) for shared project instructions and [AI_TASK_WORKFLOW.md](docs/AI_TASK_WORKFLOW.md) for implementation, review, and resume prompts. Start the assistant in your project checkout and verify its loaded context. A task is selected by the human's explicit assignment, not by an open editor tab or an owner column alone.

Coding assistants do not count as the independent human reviewer. Claims of passing checks must include actual results; mark untested behavior clearly. Coordinate shared-file/interface changes through the issue and team, just as for manually written code.

For AI-assisted task reviews, use the project-local [requesting-code-review skill](.agents/skills/requesting-code-review/SKILL.md) and its companion reviewer template. The [source record](.agents/skills/requesting-code-review/SOURCE.md) identifies the pinned upstream revision and license. Supply the assigned task's acceptance criteria, relevant architecture rules, and exact Git range; explicitly include any uncommitted changes intended for review. On Windows, use PowerShell equivalents of the upstream Bash examples. Review findings do not authorize commits, merges, publication, or board acceptance; the project and user's instructions still apply.

## Merging, releasing, and support

Merge reviewed PRs into a buildable `main`, normally using squash merge. Keep remote status checks/protection configured where the chosen plan permits; record manual enforcement otherwise. A merged task is not automatically a published release.

The milestone's rotating release coordinator gathers the [release evidence](docs/DELIVERY_PLAYBOOK.md#9-quality-and-release-responsibility), and the product owner accepts the pilot. Deliver versioned artifacts from a reviewed commit with setup instructions, notices, checksums, and known limitations. Publication is a separate assigned action.

After release, report defects through the shared issue tracker and rotate triage. Prioritize data loss, duplicates, approval bypass, or credential exposure. Verify backup/database compatibility before rolling back an application version.
