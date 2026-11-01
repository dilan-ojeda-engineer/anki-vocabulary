# A realistic session: input to studying

This is a design walkthrough of the proposed application, not a completed app or a live provider demonstration. All card content here is illustrative. The text-generation provider is still provisional.

Open [the interactive simulation](workflow-simulation.html) in a browser to step through a focused example. It uses plain HTML/CSS/JavaScript for portability; the production interface will use React and TypeScript. It makes no network calls, generates no audio or Anki files, and resets when refreshed.

## The situation

You have finished a busy workday and want to learn three expressions you encountered:

```text
draining (context: Back-to-back meetings can be draining.)
akward
put off (context: Let's not put off this conversation.)
```

With Anki desktop running and AnkiConnect installed, you choose the existing deck **English::Work and everyday life** from the app's refreshed deck list and select your saved English-coach prompt. For this session, you select ElevenLabs and a suitable American English voice. Your provider credentials were entered in settings previously.

The English Coach profile bundles that prompt with its fields, front/back layout, and audio selection. Future user profiles can define other structures. Direct delivery is now a confirmed first-release requirement; see [connection and recovery rules](AI_GENERATION.md#destination-deck-selection). The existing interactive simulation illustrates the earlier package-export flow and does not simulate live deck discovery, direct insertion, or profile editing.

We follow **draining** through the whole process. The other drafts remain in the review queue, so this demonstration sends one approved card, not three automatically approved cards.

## 1. Open the app and enter vocabulary

You launch the Windows application. You see your library, recent batches, and a **New batch** button. The input screen lets you paste the three lines and inspect the parsed targets and context before clicking **Generate draft cards**.

| What works here | Tool and reason |
|---|---|
| The desktop window and file picker | Electron provides desktop integration |
| The form, vocabulary list, and buttons | React composes reusable interface components |
| Consistent spacing, typography, and status colors | CSS Modules and shared design tokens style the interface |
| The code knows what a vocabulary item must contain | TypeScript checks our code during development |
| The actual input is checked when you submit it | Zod validates runtime data; TypeScript alone cannot validate pasted text or API responses |
| The batch survives closing the app | SQLite stores it on disk |

For a sentence entered without a target, the import preview asks you to select the word or phrase you want to learn. The example above already specifies both.

## 2. Generate drafts from your prompt

After you click **Generate draft cards**, the app sends the targets, context, and versioned coach prompt to the selected text AI. It requests structured content fields. When a response arrives, the app validates the fields and renders your exact front/back format.

For a breakdown of request construction, the model API, validation, human approval, and speech generation, see [the AI generation walkthrough](AI_GENERATION.md#a-real-example-step-by-step). The text-model integration and ElevenLabs speech integration are configured separately.

The app proposes **akward → awkward** in the review area. It generates a draft using the corrected spelling; you can edit an inappropriate correction. For **put off**, it keeps the postponement meaning specified by the example.

| What works here | Tool and reason |
|---|---|
| Submit the generation request and read its response | Node.js runs our TypeScript provider adapter outside the visual interface |
| Produce the definitions, examples, translations, and pronunciation guidance | The selected text AI uses your coach prompt; React and TypeScript do not generate this content themselves |
| Require correct fields and example counts | Zod checks the response; invalid or incomplete content stays unapproved |
| Save drafts, prompt version, and request status | Drizzle expresses queries; better-sqlite3 executes them against SQLite |
| Keep the interface responsive during processing | An Electron utility process handles the work and reports progress |
| Retrieve the configured provider key | Electron main decrypts it with safeStorage only when needed |

These database tools do different jobs: **SQLite is the database, better-sqlite3 is the Node.js driver, and Drizzle is the typed query/migration layer.** They are not three separate copies of your cards.

The React screen sends a small validated command through Electron's preload bridge. It cannot issue arbitrary filesystem commands or read decrypted saved keys. An IPC message is simply a message between the app's separate processes.

## 3. Review one card and approve it

You select **draining** in the draft queue. The preview shows:

### Front

```text
draining
“Back-to-back meetings can be draining.”
What does this expression mean?
```

### Back

```text
Meaning:
Something that uses a lot of your energy and makes you feel tired.

Category:
Adjective, based on the regular verb drain.

Pronunciation tip:
Native English:
/ˈdreɪnɪŋ/. Stress the first syllable. The vowel in drain is /eɪ/.

For Spanish speakers:
Keep the English /r/ untrilled. The final /ŋ/ is a nasal sound;
do not add a separate hard /g/. Spanish spelling is only a rough aid.

More examples:
- All these meetings are draining.
- I find long drives pretty draining.
- Dealing with complaints can be emotionally draining.

Common collocations/chunks:
- emotionally draining
- mentally draining
- a draining day

Common mistake and usage note:
Draining describes what causes tiredness. Drained describes how
you feel: “The meeting was draining. I felt drained afterward.”

Natural alternatives:
- exhausting
- tiring
- wearing me out

Spanish Translation:
agotador; desgastante, depending on the context.
```

The **Irregular Forms:** heading is absent because drain is regular. This sample has three extra examples, three chunks, and three alternatives, as permitted by your prompt.

You can edit the meaning or a sentence, regenerate just this card, or reject it. A valid structure does not guarantee correct IPA, naturalness, or translation; your review still matters.

When satisfied, you click **Approve and generate audio** for this card. The app first shows the selected provider/voice and a character estimate. Other drafts remain unapproved.

| What works here | Tool and reason |
|---|---|
| Render front/back and collect edits | React |
| Keep content and approval states consistent in our code | TypeScript domain types |
| Check the edited content | Zod |
| Approve the exact displayed revision and enqueue its audio jobs | TypeScript business logic plus a SQLite transaction |

The worker checks approval independently of the button. Editing a card afterward clears approval. Editing a spoken sentence also makes its old audio unsuitable for that sentence.

## 4. Turn the approved sentences into audio

For this one note, four sentences need audio: the front sentence and three extra examples. Definitions, IPA, headings, and Spanish guidance are not spoken by default.

The ElevenLabs adapter sends each approved sentence with the chosen voice settings and saves the returned audio locally. A Piper adapter can perform the same role using an installed local voice engine. Your card format does not change when you choose another provider.

| What works here | Tool and reason |
|---|---|
| Connect to ElevenLabs | Its JavaScript SDK inside our TypeScript TTS adapter |
| Generate the speech | ElevenLabs' hosted speech model |
| Generate speech locally instead | External Piper engine; Node.js invokes its CLI without shell interpolation |
| Save and identify audio files | Node.js filesystem and hashing functions |
| Remember completed/failed jobs and audio metadata | SQLite through better-sqlite3 and Drizzle |
| Show progress and let you listen | React and browser audio playback inside Electron |

Before requesting audio, check the local cache for the same sentence, provider, model/voice, format, and settings. A match reuses the existing file rather than consuming more allowance.

Example failure: the provider's allowance runs out after two clips. The app saves those clips, pauses the remaining jobs, and explains the quota error. After the allowance resets, **Resume** processes the missing clips. If you explicitly choose Piper instead, the app creates jobs for that provider; it does not pretend that different providers share the same cached audio.

## 5. Send the approved card to the selected deck

After all four required clips are ready, you preview the card and confirm that its destination is **English::Work and everyday life**. Click **Send approved cards to Anki**. The app verifies the connection and destination, uploads the clips, and inserts the approved note using the English Coach note type.

| What works here | Tool and reason |
|---|---|
| Refresh the actual deck list and report connection status | TypeScript AnkiConnect adapter over the local HTTP API |
| Check the approved revision and completed audio | TypeScript delivery rules in the worker |
| Upload media and create/update the app-owned note | AnkiConnect, while Anki desktop is running |
| Remember destination, source identity, external note ID, and delivery status | SQLite through the repository |
| Show the result or offer recovery for a failed item | React progress and delivery summary |

If Anki disconnects after creating the note but before the app saves the receipt, the app checks its hidden source-note identity before retrying. It must not simply create another copy. Updating the known note's fields must preserve scheduling; the real pilot verifies this behavior.

### Portable package-export alternative

For a separate package-export session, click **Export approved cards** instead. A save dialog lets you choose an `.apkg` destination. Do not use both modes on the same delivered note until identity reconciliation is implemented and tested.

| What works here | Tool and reason |
|---|---|
| Select the export location | Electron native save dialog |
| Select only approved revisions with complete audio | TypeScript export rules |
| Build notes, templates, deck metadata, and media references | ankipack behind our exporter adapter |
| Create the Anki package's collection database | sql.js, the export library's SQLite dependency |
| Write the deck package to disk | Node.js filesystem |

**sql.js serves deck creation; SQLite/better-sqlite3 serves the app's persistent library.** The two databases have different jobs.

Inside the deck, a sentence's audio field refers to a bundled file using Anki's sound syntax, for example `[sound:sentence-example.mp3]`. Each file has a unique name. The real exporter uses stored note GUIDs and persistent deck/note-type IDs so rebuilding does not create new identities for edited cards.

ankipack remains a candidate until real Anki tests verify this packaging, audio playback, repeat imports, and updates to studied notes. No simulation can establish those compatibility guarantees.

## 6. Study in Anki

For direct delivery, the card is already in the selected Anki deck. For package delivery, import the `.apkg` first. Sync Anki and wait for media sync to finish on your actual mobile Anki app, then study the card there. Anki handles scheduling and review progress. Once downloaded, the saved audio plays offline.

The vocabulary app has finished this batch. It retains your approved note and generation history so you can later edit or export it again. It does not need to call ElevenLabs every time you study.

## The tools you use while building, rather than while studying

| Tool | When we use it | Concrete value for this project |
|---|---|---|
| TypeScript compiler | Development and build checks | Catch incompatible fields/statuses before running the app; emits JavaScript |
| pnpm and lockfile | Installing dependencies and running scripts | Reproduce the same compatible package versions |
| Vite/electron-vite | Development and build | Refresh the interface during development and compile the separate Electron entry points |
| ESLint | Code review and automated checks | Detect risky or inconsistent coding patterns |
| Prettier | Source formatting | Keep code consistent and changes easy to review |
| Vitest | Logic and adapter tests | Prove that unapproved drafts cannot reach audio/export and that resume/cache rules work |
| React Testing Library | Interface tests | Exercise editing, validation messages, and approval controls from the user's perspective |
| Playwright | Desktop workflow smoke tests | Exercise the import-review-approval sequence; Electron support is experimental, so manual packaged-app checks remain |
| electron-builder | Pilot/release packaging | Bundle the desktop app and native/WASM assets for Windows distribution |
| Git | Every implementation milestone | Review differences and recover an earlier version |
| GitHub Actions, if adopted | After changes are pushed | Repeat type, lint, test, and build checks in CI |

Most group members will only interact with the desktop app, provider settings, and Anki. The development tools are for us to build and maintain it. Piper installation and voice files are additional local-engine requirements until a bundled runtime is validated.

## Sources and boundaries

The complete architecture and compatibility gates remain in [PROJECT.md](PROJECT.md#4-architecture-and-internal-interfaces); the learning contract remains in [CARD_SPEC.md](CARD_SPEC.md).

- [React components and interaction](https://react.dev/learn) and [TypeScript compile-time checking](https://www.typescriptlang.org/docs/handbook/2/basic-types.html)
- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [utility processes](https://www.electronjs.org/docs/latest/api/utility-process), and [safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3), [Drizzle SQLite](https://orm.drizzle.team/docs/sqlite/get-started-sqlite), and [Zod](https://zod.dev/)
- [Official ElevenLabs JavaScript SDK](https://github.com/elevenlabs/elevenlabs-js) and [Piper CLI](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/CLI.md)
- [ankipack](https://github.com/ImGajeed76/ankipack) and [Anki media import](https://docs.ankiweb.net/importing/text-files.html#importing-media)
- [AnkiConnect upstream](https://github.com/FooSoft/anki-connect) and [historical official API documentation](https://github.com/FooSoft/anki-connect/blob/5b6fe5766c0e1ee476c78a9de1c085b37d817cd7/README.md); verify the current installed add-on during implementation

Sources reviewed October 11, 2026. Provider features and compatibility still need implementation-time checks. The interactive illustration performs no real network requests, storage persistence, audio synthesis, or deck packaging.
