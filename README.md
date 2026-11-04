# Anki Vocabulary Studio

A planned local web tool for reviewing English Coach cards, generating target/example audio, and safely creating or updating notes in Anki.

**Status:** The local web app reports Anki availability, lists decks, imports and reviews English Coach cards, approves exact content revisions, and generates and plays cached audio using ElevenLabs/Sarah. AV-034 adds confirmed creation delivery to Anki with persisted receipts on its task branch for review. AV-002 through AV-005 remain preserved as foundation and feasibility evidence. Electron is no longer the planned first application shell; no written-card provider is adopted. The project name is a working name, and document versions remain separate from application version `0.1.0-dev.0`.

## Start here

- [Current local web direction and accepted initial requirements](docs/LOCAL_WEB_PLAN.md)
- [English Coach paste and file import formats](docs/IMPORT_FORMATS.md)
- [Windows development setup, checks, and AV-002 evidence](docs/DEVELOPMENT.md)
- [Shared contracts, synthetic fixtures, and AV-003 scope](docs/SHARED_CONTRACTS.md)
- [AV-004 Anki experiment, actual evidence, and limitations](docs/ANKI_FEASIBILITY.md)
- [AV-005 text-model results, local setup, and cards for review](docs/TEXT_FEASIBILITY.md)
- [Project brief, requirements, architecture, and delivery plan](docs/PROJECT.md)
- [Card specification and your original prompt](docs/CARD_SPEC.md)
- [How AI generation works, TypeScript boundaries, and future custom profiles](docs/AI_GENERATION.md)
- [Three-developer team organization and delivery process](docs/DELIVERY_PLAYBOOK.md)
- [Current local-web task backlog and historical Electron records](docs/BACKLOG.md)
- [Five-word prototype configuration, readiness, and acceptance scenarios](docs/PROTOTYPE_PLAN.md)
- [English Coach evaluation inputs, expectations, and review rubric](docs/AI_EVALUATION.md)
- [Product and architecture decision register](docs/DECISIONS.md)
- [How to contribute and review changes](CONTRIBUTING.md)
- [Shared instructions for coding assistants](AGENTS.md)
- [Assigning, reviewing, and resuming an AI coding task](docs/AI_TASK_WORKFLOW.md)
- [A realistic session and the tools behind every step](docs/WORKFLOW_WALKTHROUGH.md)
- [Interactive workflow simulation](docs/workflow-simulation.html) — open in a browser; uses sample data and makes no provider calls.

The planned first-release workflow is:

1. Open the local workspace. Paste/import English Coach cards while Anki is closed, or connect to Anki to load supported existing notes.
2. Save the pending cards locally and resume them after a browser or server restart.
3. Review, validate, edit, include/exclude, and preview cards one by one.
4. Generate and listen to target/front-example/additional-example audio individually or for all missing items.
5. Open Anki, select a current destination deck, confirm the send, and create or safely update notes without resetting scheduling.
6. Open the result in Anki Preview, then sync and study through Anki.

Each group member runs their own installation, stores their own data, and uses their own provider accounts and API keys.

## Current technology direction

The application remains in this repository and uses **strict TypeScript, React, and a local Node server**. It opens in the user's browser, binds only to loopback, and communicates with the running Anki Desktop application through AnkiConnect. The Electron scaffold remains until reusable code is extracted and the local web vertical slice works.

| Area | Tools |
|---|---|
| App development | TypeScript in strict mode, React, Vite, local Node server |
| Styling | CSS Modules and shared design tokens |
| Local data | Server-owned, versioned workspace for pending cards/audio/receipts; Anki for delivered notes and synced media |
| Validation | Zod for imports, cards, audio commands, and provider/Anki responses |
| Audio | Replaceable server-side TypeScript adapter; initial provider/voice pending listening review |
| Written generation | Deferred provider decision; AV-005 evidence preserved |
| Anki integration | Existing TypeScript AnkiConnect adapter for decks, notes, media, identity, and safe updates |
| Credentials | Local server only; never browser storage, cards, logs, exports, or Git |
| Development quality | npm, ESLint, Prettier, Vitest, React Testing Library, Playwright |
| Distribution | Local development/start command first; packaging deferred until the vertical slice is useful |

See the [local web plan](docs/LOCAL_WEB_PLAN.md) for current boundaries and acceptance scenarios. [PROJECT.md](docs/PROJECT.md) retains the earlier Electron proposal as historical design context until its reusable requirements are migrated.

See the [Anki note structure review](docs/ANKI_NOTE_STRUCTURE.md) for the mapping between official teaching sections, audio fields, and internal tracking fields visible in Anki's editor. Its smaller-layout recommendation is documented; existing note types have not been migrated.

## Run the local web foundation

Prerequisites are Node.js 26.13.x, npm 11.20.0, and—when testing the live connection—a running Anki Desktop installation with the supported AnkiConnect API. Install dependencies and start the loopback server:

```powershell
npm install
npm run dev:web
```

Open `http://127.0.0.1:43110` in a browser. You can preview and save imports locally while Anki is closed. Refreshing connection status and choosing a displayed deck do not change Anki. Stop the server with `Ctrl+C`.

For the existing isolated Windows test collection, close Anki normally and run `npm run anki:test`, then refresh the app's Anki connection. This opens `.tools/anki-av004` with its supported add-on and disposable **User 1** profile. Opening Anki from its ordinary shortcut uses your regular collection instead; it does not select this test setup. The command refuses to start while any Anki instance is running, and it never closes Anki, copies add-ons into your regular collection, or creates a missing test collection. Fresh machines must first prepare the disposable setup described in [Anki feasibility evidence](docs/ANKI_FEASIBILITY.md); optionally set `ANKI_EXECUTABLE` if Anki is installed outside `%LOCALAPPDATA%\Programs\Anki\Anki.exe`.

After changing server or shared TypeScript code during development, stop and rerun `npm run dev:web`, then reload the browser page. The browser updates its UI automatically, but this command does not restart the Node server.

For speech, use **Speech settings** in the app: paste your ElevenLabs key once and choose **Validate and save key**. The server checks account access, stores the key with Windows encryption outside the card/audio workspace, and activates it immediately. Later starts reuse it and automatically check allowance. You can check the account, replace the key, or remove it in the same panel. Saved audio remains playable when no key is configured. See [storage boundaries and recovery](docs/SPEECH_SETTINGS.md).

The optional `npm run dev:web:with-key` hidden terminal prompt remains available for a temporary key; it does not persist the key. If delivery reports incomplete or stale selected audio, generate or retry those items first, then prepare a new delivery preview.

The initial voice is Sarah with `eleven_multilingual_v2`, normal speed, and MP3 output. Approve a card, choose one item or a batch, review the provider/voice/format/count and reported allowance, then confirm generation. Queue audio can prepare all missing or selected placements across saved approved cards; it shows combined totals and deduplicates matching speech. The server rechecks approval and free allowance, preserves successes on partial failure, and requires an explicit retry for remaining work. Closing the browser may leave the current server request finishing; prepare again to resume missing queue items. Changing content clears approval; after reapproval, old clips appear for comparison and exact cached speech can be reused. Fish Audio and selectable voices/voice groups remain future work.

Run the complete local validation with:

```powershell
npm run check
```

## Decks and supported note types

Any existing Anki deck can be selected as the destination. New notes initially use the app-owned English Coach note type, and existing supported English Coach notes can be loaded and updated. A deck can contain several unrelated note types, so arbitrary field editing requires a later explicit mapping workflow.

The first release uses your supplied English-coach profile. A confirmed future feature lets users supply their own prompts and card structures. Keep the prompt, field definitions, front/back layout, and audio-field selection in a versioned profile rather than making the coach format a universal requirement. See [the profile design](docs/AI_GENERATION.md#future-custom-prompts-and-card-structures).

## Local web boundary

This is a local browser interface backed by a loopback Node service, not a publicly hosted application. Hosted deployment, accounts, authentication, and multi-user storage remain outside this phase.

## How we will build this together

**Dilan, Bulma, and Trunks**, all full-stack developers, will build the project together. Use a shared Kanban backlog with weekly planning/demos, one owner and a peer reviewer per task, small pull requests, and automated checks. Current local-web owners/reviewers are unassigned; confirm them and the coordinating roles before treating a task as Ready. Codex supports their work rather than replacing team accountability.

The [delivery playbook](docs/DELIVERY_PLAYBOOK.md) covers the process from discovery through release/support. [BACKLOG.md](docs/BACKLOG.md) defines AV-028 through AV-036 as the current local-web sequence and preserves AV-001 through AV-027 as historical Electron-first records. Human owners and reviewers remain unassigned; remote repository, board, and CI configuration remain unstarted.

You can request changes in plain English; keep accepted scope and decisions in the project documents and, once adopted, track live tasks on the shared issue board.

AV-028 through AV-033 are merged. Initial Sarah selection and one-item playback evidence are recorded; complete card-audio listening and human milestone acceptance remain pending. Fish Audio and individual voice/voice-group selection remain future improvements.

AV-034 creation delivery is merged. Select an existing normal destination deck and saved cards, preview per-item decisions, acknowledge card/audio review, then explicitly confirm Send. Selected audio must be complete for the exact approved revision. Delivery intent and receipts persist in `delivery/delivery.json` inside the local application data directory. Reconnection and restart never send automatically.

AV-035 adds **Update existing Anki notes** for notes delivered by this workspace. Its guided flow is **Edit card → Prepare audio → Review changes → Update in Anki**. **Save and continue** saves and approves the text, changed speech gets a targeted generation action, and unchanged clips are kept automatically. **Replace audio** sits beside each clip; one review action shows text and audio differences before explicit confirmation. See the [card update guide](docs/UPDATE_CARD_GUIDE.md). Close any Anki editor for the note before confirmation. Saved update results and explicit reconciliation use `delivery/updates.json`; uncertain outcomes are never blindly retried. Note/card identities and scheduling are checked before and after the update. See [validation and API concurrency limits](docs/evidence/AV-035-note-updates.md). Arbitrary note types and model migrations remain deferred.

The product owner judges whether the cards and voices are useful for learning and accepts milestone demonstrations. Each developer owns their assigned changes and evidence; another developer reviews them. Codex helps implement, explain, test, and document work within an assigned task.

Use the [reusable task prompt](docs/AI_TASK_WORKFLOW.md#reusable-implementation-assignment) for a selected task. The team should agree readiness and ownership before implementation. Provider keys belong in the documented server-side encrypted storage or temporary environment configuration; never paste them into chat or commit them to source control.
