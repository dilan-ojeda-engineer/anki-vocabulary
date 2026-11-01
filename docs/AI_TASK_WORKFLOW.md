# Assigning work to a coding AI

**Version:** 0.1  
**Date:** October 11, 2026  
**Status:** Instructions and reusable prompts prepared; no implementation task is started by this document.

## What chooses the task

The human developer gives the AI a task ID and scope. The backlog or live issue supplies its criteria; [AGENTS.md](../AGENTS.md) supplies the shared working rules. A filename, owner column, or open IDE tab alone is not an instruction to begin implementation.

| Source | Responsibility |
|---|---|
| Task prompt | Select current task, human owner, scope, reviewer, and any current decisions |
| BACKLOG.md or linked live issue | Describe outcome, dependencies, criteria, and task status |
| AGENTS.md | Define shared coding, collaboration, validation, and reporting rules |
| Relevant specifications and existing code | Supply product behavior and implemented contracts |
| PR and evidence | Make the actual result reviewable by another human developer |

Each developer can use a separate coding-AI session on their own checkout/branch. Share decisions through issues and repository files; do not assume sessions share chat memory. Proposed owner names do not automatically authorize the AI to impersonate a teammate or change a remote assignment.

## Start a session

1. Agree a task with the team and check its readiness/dependencies. Names in the initial backlog are proposed allocations until accepted.
2. Open `C:\projects\anki-vocabulary` as the project workspace/working directory, or your own clone's equivalent. With no Git root yet, starting from the parent `C:\projects` may not discover the child project's instructions automatically.
3. Start a new Codex session after adding/changing project instructions. If using another coding assistant, explicitly tell it to read AGENTS.md according to that tool's support.
4. Verify context with a read-only request: `Summarize the project instructions you loaded and the current implementation status. Do not edit files.`
5. Paste the assignment below with every placeholder replaced. An `AV-...` ID is how the AI finds the intended work; no automated dispatcher is installed.

Codex discovers AGENTS.md guidance when a run/session starts and uses the working directory/project root during discovery. These setup recommendations follow the [official OpenAI documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md). They are not evidence that a session has loaded this project's new file; the context check above verifies that.

## Reusable implementation assignment

```text
Human owner: <Dilan / Bulma / Trunks>
Task: <AV-ID and title>
Peer reviewer: <different developer>
Workspace/branch: <your checkout and task branch, or note Git is not initialized>

Read AGENTS.md and this task in docs/BACKLOG.md
(or the linked issue: <URL, if adopted>). Use its acceptance criteria.
Read the relevant specifications and inspect the existing implementation.

Scope for this session: <the whole Ready task or an explicitly agreed subset>
Current decisions/dependency evidence: <links or recorded facts, if needed>

Check prerequisites. Use only the fixtures allowed by the task if a real
integration is unavailable, and identify any remaining integration gap.
Before editing, explain the intended changes, then implement the assigned scope.
Run appropriate checks and update documentation affected by this behavior.

Prepare the result for peer review. Report:
- Task and outcome
- Changes and relevant files
- Acceptance criteria satisfied and remaining gaps
- Checks actually run, results, and checks not run
- Decisions, blockers, and follow-up work

Stay within this assignment; do not start the next backlog task.
Do not mark the task Done or merge/publish without the agreed human review.
```

The scope line lets the team split large issues into explicit sessions. If only a subset is assigned, the report must show which whole-task criteria remain unsatisfied; the issue cannot be closed on partial evidence.

## Example for Dilan, when AV-012 prerequisites are ready

This example is not an instruction to execute AV-012 now:

```text
I am Dilan. Implement AV-012: Card preview/edit/reject/approve interface.
Reviewer: Bulma. Work in my task checkout on feat/AV-012-card-review.

Read AGENTS.md and AV-012 in docs/BACKLOG.md.
Use docs/CARD_SPEC.md for the English Coach layout.
Check the shared contracts from AV-003. Use the agreed fake drafts while
generation integration is unavailable, and document that limitation.

Explain intended changes before editing, implement AV-012's scope,
and run relevant checks. Prepare an acceptance/evidence summary for Bulma.
Do not implement the text provider, speech engine, or Anki adapter in this task.
```

Bulma and Trunks use the same format with their agreed task IDs. Dependencies still matter: an example prompt does not make an unready issue ready.

## Reusable review assignment

```text
I am <human reviewer>. Review <PR URL or local diff> for <AV-ID>.
Read AGENTS.md and the task's acceptance criteria, then inspect the changes
and supplied evidence. Do not edit files during this review.

Report concrete findings with file references and severity, missing acceptance
evidence, and relevant data/interface/recovery risks. Identify checks not run.
If there are no findings, say so and describe any material validation gaps.
Do not submit a remote review or merge unless explicitly instructed.
```

AI review assists the human reviewer; it does not satisfy the team's independent human approval requirement. A developer should understand critical approval, credential, migration, and Anki identity changes before accepting them.

## Reusable resume assignment

```text
Resume <AV-ID> in <checkout/branch>. Human owner: <name>; reviewer: <name>.
Read AGENTS.md, the current task record, and the prior evidence/handoff:
<PR link, issue comment, or repository note>.

Inspect the current files/diff and actual check results before continuing.
Remaining scope: <unfinished criteria or agreed subset>.
Explain the next material changes, finish this scope, and report updated evidence.
Preserve unrelated changes and do not assume another chat's work was merged.
```

Keep the handoff small: task/branch, completed criteria, remaining work, changed shared contracts, checks/results, and decisions. Put it in the task issue/PR when adopted; avoid a single shared mutable 'current task' file that all three sessions overwrite.

## Finish and hand over

The owner reviews the AI's changes and opens a PR. The peer reviewer checks behavior/evidence. After the agreed checks and human review, merge and update task status through the team workflow. A coding assistant only performs remote status/review/merge actions when explicitly authorized and the required access exists.

Until Git/hosting/CI are configured, evidence can be local and document work can proceed, but it must not be described as a merged PR or remote assignment. The next implementation task remains a human selection; this guide does not begin AV-002 or any other ticket.
