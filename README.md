# Anki Vocabulary Studio

A planned local web tool for reviewing English Coach cards, generating target/example audio, and safely creating or updating notes in Anki.

**Status:** The owner accepted a local web direction and initial Anki Card and Audio Workspace requirements on November 2, 2026. AV-002 through AV-005 remain preserved as foundation and feasibility evidence. Electron is no longer the planned first application shell; no production audio provider or written-card provider is adopted. The local web implementation has not started. The project name is a working name, and document versions remain separate from application version `0.1.0-dev.0`.

## Start here

- [Current local web direction and accepted initial requirements](docs/LOCAL_WEB_PLAN.md)
- [Windows development setup, checks, and AV-002 evidence](docs/DEVELOPMENT.md)
- [Shared contracts, synthetic fixtures, and AV-003 scope](docs/SHARED_CONTRACTS.md)
- [AV-004 Anki experiment, actual evidence, and limitations](docs/ANKI_FEASIBILITY.md)
- [AV-005 text-model results, local setup, and cards for review](docs/TEXT_FEASIBILITY.md)
- [Project brief, requirements, architecture, and delivery plan](docs/PROJECT.md)
- [Card specification and your original prompt](docs/CARD_SPEC.md)
- [How AI generation works, TypeScript boundaries, and future custom profiles](docs/AI_GENERATION.md)
- [Three-developer team organization and delivery process](docs/DELIVERY_PLAYBOOK.md)
- [Initial task backlog, proposed owners, and acceptance criteria](docs/BACKLOG.md)
- [Five-word prototype configuration, readiness, and acceptance scenarios](docs/PROTOTYPE_PLAN.md)
- [English Coach evaluation inputs, expectations, and review rubric](docs/AI_EVALUATION.md)
- [Product and architecture decision register](docs/DECISIONS.md)
- [How to contribute and review changes](CONTRIBUTING.md)
- [Shared instructions for coding assistants](AGENTS.md)
- [Assigning, reviewing, and resuming an AI coding task](docs/AI_TASK_WORKFLOW.md)
- [A realistic session and the tools behind every step](docs/WORKFLOW_WALKTHROUGH.md)
- [Interactive workflow simulation](docs/workflow-simulation.html) — open in a browser; uses sample data and makes no provider calls.

The current first-release workflow is:

1. Connect to Anki Desktop through AnkiConnect and select an existing destination deck.
2. Paste/import English Coach cards or load supported existing notes.
3. Review, validate, edit, include/exclude, and preview cards one by one.
4. Generate and listen to target/front-example/additional-example audio individually or for all missing items.
5. Create new notes or safely update supported existing notes without resetting scheduling.
6. Open the result in Anki Preview, then sync and study through Anki.

Each group member runs their own installation, stores their own data, and uses their own provider accounts and API keys.

## Current technology direction

The application remains in this repository and uses **strict TypeScript, React, and a local Node server**. It opens in the user's browser, binds only to loopback, and communicates with the running Anki Desktop application through AnkiConnect. The Electron scaffold remains until reusable code is extracted and the local web vertical slice works.

| Area | Tools |
|---|---|
| App development | TypeScript in strict mode, React, Vite, local Node server |
| Styling | CSS Modules and shared design tokens |
| Local data | Anki for delivered notes/media; add app persistence only for demonstrated pending-work needs |
| Validation | Zod for imports, cards, audio commands, and provider/Anki responses |
| Audio | Replaceable server-side TypeScript adapter; initial provider/voice pending listening review |
| Written generation | Deferred provider decision; AV-005 evidence preserved |
| Anki integration | Existing TypeScript AnkiConnect adapter for decks, notes, media, identity, and safe updates |
| Credentials | Local server only; never browser storage, cards, logs, exports, or Git |
| Development quality | npm, ESLint, Prettier, Vitest, React Testing Library, Playwright |
| Distribution | Local development/start command first; packaging deferred until the vertical slice is useful |

See the [local web plan](docs/LOCAL_WEB_PLAN.md) for current boundaries and acceptance scenarios. [PROJECT.md](docs/PROJECT.md) retains the earlier Electron proposal as historical design context until its reusable requirements are migrated.

## Decks and supported note types

Any existing Anki deck can be selected as the destination. New notes initially use the app-owned English Coach note type, and existing supported English Coach notes can be loaded and updated. A deck can contain several unrelated note types, so arbitrary field editing requires a later explicit mapping workflow.

The first release uses your supplied English-coach profile. A confirmed future feature lets users supply their own prompts and card structures. Keep the prompt, field definitions, front/back layout, and audio-field selection in a versioned profile rather than making the coach format a universal requirement. See [the profile design](docs/AI_GENERATION.md#future-custom-prompts-and-card-structures).

## Local web boundary

This is a local browser interface backed by a loopback Node service, not a publicly hosted application. Hosted deployment, accounts, authentication, and multi-user storage remain outside this phase.

## How we will build this together

**Dilan, Bulma, and Trunks**, all full-stack developers, will build the project together. Use a shared Kanban backlog with weekly planning/demos, one owner and a peer reviewer per task, small pull requests, and automated checks. Named task assignments are proposed in the backlog; confirm availability and coordinating roles at kickoff. Codex supports their work rather than replacing team accountability.

Start with team kickoff, repository/tooling setup, shared contracts, and focused integration experiments. The [delivery playbook](docs/DELIVERY_PLAYBOOK.md) covers the process from discovery through release/support; [BACKLOG.md](docs/BACKLOG.md) assigns proposed tasks and dependencies. Remote repository, board, and CI configuration remain unstarted.

You can request changes in plain English; keep accepted scope and decisions in the project documents and, once adopted, track live tasks on the shared issue board.

Next, replace the historical desktop backlog with small local web tasks, then build the accepted five-card vertical slice in a disposable Anki profile. Audio provider/voice selection remains a separate prerequisite for real voice evidence.

The product owner judges whether the cards and voices are useful for learning and accepts milestone demonstrations. Each developer owns their assigned changes and evidence; another developer reviews them. Codex helps implement, explain, test, and document work within an assigned task.

A useful next implementation request is:

> I am Dilan. Work on AV-002 from docs/BACKLOG.md in my project checkout. Read AGENTS.md, check its prerequisites, and explain the intended changes before editing. Implement the agreed foundation scope, run relevant checks, and prepare the result for Trunks's review. Keep unresolved remote hosting as a documented gap and do not begin provider integrations.

This is an example assignment, not an instruction to start AV-002 now. Use the [reusable task prompt](docs/AI_TASK_WORKFLOW.md#reusable-implementation-assignment) for any selected task. The team should agree readiness and ownership before implementation.

No installation or launch commands are provided yet because the app does not exist. Provider keys should be entered through the eventual app settings, never pasted into this chat or committed to source control.
