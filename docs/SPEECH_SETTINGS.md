# Local speech credentials

The owner authorized persistent credential management on November 3, 2026, after repeated manual setup blocked AV-034 testing. This is a focused follow-up to the local audio workflow, not authorization to start AV-035. Human acceptance remains pending.

## User workflow

Start the local server with `npm run dev:web`. Open Speech settings, paste an ElevenLabs key into the password field, and choose **Validate and save key**. This checks the account endpoint without generating speech, encrypts the key, clears the input, and activates it without restarting the server. Invalid replacements leave the existing key intact. A valid account whose free allowance is unavailable can be saved, but speech generation remains blocked.

Later starts reuse the encrypted key and automatically check the account. **Check connection and allowance** refreshes the account report; it does not synthesize speech. **Remove key** removes the saved and active credential while preserving cards and cached audio. Replacement and removal wait for in-flight speech commands. Every generation request still checks the current account's free allowance, exact content approval, and audio selection.

An explicitly supplied `ELEVENLABS_API_KEY` remains a temporary compatibility option when no saved credential choice exists; it is never silently persisted. Saved keys take precedence. Explicit removal is remembered across restarts so an inherited environment key cannot silently reactivate generation.

## Storage and boundaries

- The Node server uses Windows DPAPI with `CurrentUser` scope through the pinned `@primno/dpapi` adapter. This is the local-web equivalent of the Windows protection described for Electron safeStorage in PROJECT.md; Electron is not launched by the web server.
- The default store is `%LOCALAPPDATA%\AnkiVocabularyStudioCredentials\elevenlabs.dpapi`, separate from `%LOCALAPPDATA%\AnkiVocabularyStudio` cards/media. The credential directory must be excluded from manual backups and future workspace backup/export implementations. `LOCAL_WEB_CREDENTIAL_DIR` exists for isolated tests.
- Writes encrypt first and atomically replace the protected file. Encryption or decryption failure is reported; there is no plaintext fallback. Removal replaces the protected payload with an empty credential choice, retaining no API key.
- The browser submits a newly entered key once through a loopback-only, origin/session-token protected POST. Stored/decrypted keys are never returned to React. The password field is cleared on submission; no browser storage, URL parameters, command-line arguments, logging, cards, or audio metadata receive the key.
- API responses expose only fixed status/error codes, source, check time, and validated allowance totals. Provider bodies and raw transport errors are not forwarded. Invalid, extra, malformed, and oversized request payloads are rejected.
- DPAPI protects the credential for the current Windows account. It does not isolate it from other software running as that same Windows user. Moving app data to another computer/account requires configuring a key again. Unsupported platforms cannot save keys through this Windows adapter.

## Validation and acceptance

Controlled tests use fake keys, injected account checks, and test encryption. Cases cover encrypted persistence/restart, replacement failure, unavailable encryption, corrupted storage, account/quota states, removal with an inherited environment key, serialized credential changes, HTTP origin/session/schema/size protection, and dynamic audio activation/removal while retaining playback. A Windows-only test uses real DPAPI with a fake key and verifies round-trip, absence of plaintext, and tamper rejection. Real provider generation and human listening are separate acceptance evidence, not implied by these checks.

`npm run check` passed with 129 tests, type checking, lint, formatting, Electron build, and local-web build. The runtime dependency audit reported zero production vulnerabilities. An isolated browser check confirmed that the password field masks input, the save control responds to entry, and a malformed fake key is rejected and cleared without an account call. The running main server was restarted with the new backend; it reported Windows storage available and retained all ten saved cards. No real credential was installed or provider synthesis performed by this change.

The owner entered a key in Speech settings and reported successful validation/storage. A read-only status check confirmed `source: saved`, `state: ready`, and no issue. After stopping and restarting the server without supplying an environment key, the automatic account check again returned `source: saved`, `state: ready`, and no issue, with a later check time (November 3, 2026, 17:12:06 UTC). All ten saved cards remained present. This verifies encrypted-key reuse and automatic live account validation across a process restart without asking the owner to re-enter the key. No speech was generated or card delivered during this check.

The next acceptance action is one selected audio generation and owner listening. No real credential is installed by an automated test.
