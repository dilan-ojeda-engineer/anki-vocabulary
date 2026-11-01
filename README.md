# Anki Vocabulary Studio

A planned Windows app that turns vocabulary and contextual sentences into reviewed Anki cards with audio.

**Status:** AV-002 foundation merged; AV-003 shared contracts prepared for human review, November 1, 2026. The Electron/React skeleton is implemented; vocabulary generation, speech, and Anki delivery remain unimplemented. The project name is a working name. Document version 0.7 is separate from application version `0.1.0-dev.0`.

## Start here

- [Windows development setup, checks, and AV-002 evidence](docs/DEVELOPMENT.md)
- [Shared contracts, synthetic fixtures, and AV-003 scope](docs/SHARED_CONTRACTS.md)
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

The intended workflow is:

1. Enter words, expressions, or sentences containing the vocabulary you want to learn, and select the destination deck.
2. Generate draft cards using your English-coach prompt.
3. Review the front and back, edit or regenerate individual drafts, and approve the cards you want.
4. Generate sentence audio using local Piper or hosted ElevenLabs.
5. Preview the result and send approved cards and audio to the selected existing Anki deck. Anki desktop must be running with AnkiConnect installed.
6. Sync Anki to your mobile device and study there. Package export as `.apkg` is also available for manual import.

Each group member runs their own installation, stores their own data, and uses their own provider accounts and API keys.

## Proposed technology stack

The core application will use **TypeScript, React, and Electron**. React builds the visual interface; Electron packages it as a Windows desktop app and provides a Node.js environment for local processing.

| Area | Tools |
|---|---|
| App development | TypeScript in strict mode, React, Electron, electron-vite |
| Styling | CSS Modules and shared design tokens |
| Local data | SQLite, better-sqlite3, Drizzle ORM and migrations |
| Validation | Zod for inputs, generated cards, and messages between app processes |
| Text and hosted audio | Replaceable TypeScript API adapters; ElevenLabs for audio; text provider still provisional |
| Local audio | External Piper engine, invoked from TypeScript; current setup requires Python and a voice model |
| Anki delivery | TypeScript AnkiConnect adapter for deck listing/direct delivery; ankipack with sql.js for package export, subject to compatibility tests |
| Credential protection | Electron safeStorage using Windows-provided encryption |
| Development quality | npm, ESLint, Prettier, Vitest, React Testing Library, Playwright |
| Windows packaging | electron-builder |

See the [architecture and stack rationale](docs/PROJECT.md#4-architecture-and-internal-interfaces) for boundaries, tradeoffs, and release checks. The application stack is a recommendation aligned with your TypeScript/JavaScript preference; packages and exact compatible versions will be validated and locked during the prototype.

All application code can be TypeScript, including React's `.tsx` files; CSS handles styling. Piper is an external engine whose currently proposed setup also needs Python. A requirement to avoid that runtime entirely would require a different, validated local speech engine.

## Decks and future custom profiles

Deck selection and direct delivery to existing Anki decks are confirmed first-release requirements. Use AnkiConnect to refresh the actual deck list and send approved notes/media. Show the destination before delivery and recover interrupted batches without duplicate insertion. Package export remains a portable alternative; switching delivery modes for the same notes requires verified identity reconciliation.

The first release uses your supplied English-coach profile. A confirmed future feature lets users supply their own prompts and card structures. Keep the prompt, field definitions, front/back layout, and audio-field selection in a versioned profile rather than making the coach format a universal requirement. See [the profile design](docs/AI_GENERATION.md#future-custom-prompts-and-card-structures).

## Future web application

A hosted web version is a confirmed future phase after the desktop release. Keep React components, card schemas, approval rules, prompts, and provider/export logic reusable through explicit interfaces. Isolate Electron, local storage, credential encryption, and Piper execution in platform adapters.

The web phase will add browser access, authentication, separate user data, server processing, protected credentials, and hosted media storage. Its deployment, operating budget, and desktop-data migration will be planned separately. See the [future web roadmap](docs/PROJECT.md#future-web-application-confirmed-roadmap-item).

## How we will build this together

**Dilan, Bulma, and Trunks**, all full-stack developers, will build the project together. Use a shared Kanban backlog with weekly planning/demos, one owner and a peer reviewer per task, small pull requests, and automated checks. Named task assignments are proposed in the backlog; confirm availability and coordinating roles at kickoff. Codex supports their work rather than replacing team accountability.

Start with team kickoff, repository/tooling setup, shared contracts, and focused integration experiments. The [delivery playbook](docs/DELIVERY_PLAYBOOK.md) covers the process from discovery through release/support; [BACKLOG.md](docs/BACKLOG.md) assigns proposed tasks and dependencies. Remote repository, board, and CI configuration remain unstarted.

You can request changes in plain English; keep accepted scope and decisions in the project documents and, once adopted, track live tasks on the shared issue board.

Next, build a small example with five vocabulary items. Check the card content, approve it, listen to the audio, select an existing deck in an Anki test profile, and send the cards directly. Also test package import separately. This validates the complete workflow before expanding the interface.

Then implement the local visual app, reliable batch processing, backups, and installation instructions. Each milestone must have a working demonstration and relevant checks before moving on.

The product owner judges whether the cards and voices are useful for learning and accepts milestone demonstrations. Each developer owns their assigned changes and evidence; another developer reviews them. Codex helps implement, explain, test, and document work within an assigned task.

A useful next implementation request is:

> I am Dilan. Work on AV-002 from docs/BACKLOG.md in my project checkout. Read AGENTS.md, check its prerequisites, and explain the intended changes before editing. Implement the agreed foundation scope, run relevant checks, and prepare the result for Trunks's review. Keep unresolved remote hosting as a documented gap and do not begin provider integrations.

This is an example assignment, not an instruction to start AV-002 now. Use the [reusable task prompt](docs/AI_TASK_WORKFLOW.md#reusable-implementation-assignment) for any selected task. The team should agree readiness and ownership before implementation.

No installation or launch commands are provided yet because the app does not exist. Provider keys should be entered through the eventual app settings, never pasted into this chat or committed to source control.
