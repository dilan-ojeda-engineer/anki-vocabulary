# Development setup and AV-002 evidence

## Windows onboarding

Install Git for Windows and Node.js **26.13.0**, matching `.node-version`. Open a new PowerShell terminal after installation and confirm `git --version` and `node --version`. Use the official [Node downloads](https://nodejs.org/en/download) and [npm documentation](https://docs.npmjs.com/cli/v11/commands/npm-ci).

Use npm **11.20.0**, the version pinned in `package.json` and verified with the owner's installed Node.js. If your installation includes a different npm version, install the pin with `npm install --global npm@11.20.0`. Confirm the versions, then run these commands from the project root:

```powershell
npm --version
node --version
npm ci
npm run dev
```

The skeleton needs no API keys, provider account, Anki installation, or Piper runtime. It opens a desktop foundation screen and reads the application name/version through a narrow, validated Electron bridge. Close the app and stop the development command with Ctrl+C when finished. `npm start` opens the previously built application.

This development version is `0.1.0-dev.0`; no prototype release or release tag is implied. Each developer uses their own checkout and local data. Never copy another person's credentials or live Anki collection into it.

## Checks

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Strict TypeScript checks for desktop and renderer code |
| `npm run lint` | ESLint, TypeScript, and React rules |
| `npm run format:check` | Prettier check for scaffold/configuration files |
| `npm run format` | Format scaffold/configuration files |
| `npm test` | Offline boundary validation tests |
| `npm run build` | Compile main, sandboxed preload, and renderer |
| `npm run check` | Type, lint, formatting, unit tests, and build |
| `npm run test:e2e` | Build and launch real Electron; verify bridge, isolation, and narrow layout |

The end-to-end tests launch windows and need an interactive Windows desktop. They verify both built assets and the live development renderer on loopback port 5173; keep that port free. Playwright starts Vite directly using `vite.renderer.config.ts`, shared with electron-vite, and the tests own the Electron instances. They use Electron's downloaded binary; no separate Playwright browser installation is required. The project's postinstall script explicitly installs the pinned Electron runtime. Existing planning documents, the workflow simulation, and the archived teaching prompt are excluded from automatic formatting to preserve the baseline. Check documentation changes manually.

`npm run package:win` is not implemented in AV-002. Native SQLite/WASM/export packaging belongs to AV-008, and release packaging to AV-023. Dependencies for those integrations are deliberately deferred.

## Process boundaries

- `src/renderer`: React and CSS; accesses only the typed `window.desktop` API.
- `src/preload`: sandbox-compatible CommonJS bundle exposing only `getAppInfo` and validating its response.
- `src/main`: owns the window and validates IPC sender, frame, document, and argument count. Blocks external navigation, new windows, webviews, and permissions.
- `src/shared`: minimal runtime schema and transport types for the foundation screen. AV-003 will define the domain contracts separately.

Database writes and durable jobs will belong to a TypeScript utility worker when their assigned tasks begin. This scaffold has no database, credentials, provider integration, or job processing. Do not add those operations to React or preload.

The dev server binds to loopback port 5173. A serve-only transform permits inline React refresh/style injection and the loopback HMR WebSocket during development. The built content security policy has no inline script/style or WebSocket allowance; production assets load locally. Keep raw Node/Electron APIs outside the bridge.

## Reproducibility and collaboration

Direct dependencies and tooling are pinned; `package-lock.json` fixes transitive dependencies. Use `npm ci` for onboarding and CI. npm runs dependency lifecycle scripts and the explicit root Electron installer during installation. Review those scripts when changing dependencies; the former pnpm build-script allowlist does not apply to npm. Review dependency changes together with their lockfile changes.

`.gitattributes` normalizes source text to LF across Windows checkouts. `.editorconfig`, ESLint, and Prettier define source formatting. `.gitignore` excludes environment secrets, local databases, backups, voices, audio/decks, build output, test output, and optional portable tooling in `.tools/`.

The Windows workflow at [checks.yml](../.github/workflows/checks.yml) is prepared for GitHub hosting. **No remote, remote workflow run, branch protection, or required review check is configured or verified.** Until hosting is chosen under AV-001, enforce the [contribution rules](../CONTRIBUTING.md#git-conventions) manually. Adding the workflow does not authorize a push or publication.

## Acceptance record

AV-002 was explicitly assigned on November 1, 2026. Local foundation work proceeds independently of the still-open AV-001 hosting and team appointments. No proposed human reviewer assignment is treated as accepted.

Initial pnpm validation, before the user-requested npm switch, observed locally on November 1, 2026:

- Baseline committed as `aa7690b`; implementation is prepared for review on `chore/AV-002-foundation`. The owner authorized the foundation commit after local validation; human acceptance remains pending.
- Official Node.js 24.22.2 Windows x64 archive downloaded into ignored `.tools/` and verified against the published SHA256. pnpm 10.34.9 installed there without changing the system Node installation or PATH.
- Initial dependency installation and subsequent `pnpm install --frozen-lockfile` passed. Direct dependencies and transitive resolutions are recorded in the manifest/lockfile. TypeScript 6.0.3 was selected to satisfy typescript-eslint's declared supported range rather than the registry's newer major.
- `pnpm check` passed: strict desktop/renderer/test types, ESLint with zero warnings, Prettier, three boundary unit tests, and a production build.
- `pnpm test:e2e` passed both built and development Electron launch tests. The bridge returned application metadata; renderer `require`/`process` were absent; narrow content had no horizontal overflow. The built policy excludes inline allowances. A 390-pixel screenshot was visually inspected and was readable without clipping.
- These are local shell/boundary checks with no provider calls. No text generation, speech, database, Anki integration, packaging, or linguistic review was performed.

After switching to npm on November 1, 2026:

- npm 11.19.1 generated `package-lock.json`; the pnpm lockfile and configuration were removed. The previous dependency tree was moved to ignored `.tools/pnpm-node-modules` before installing with npm. The old local pnpm executable remains ignored tooling, not a project dependency or requirement.
- `npm ci` passed, recreating dependencies from the npm lockfile and installing the pinned Electron runtime.
- `npm run check` passed: strict types, lint, formatting, all three unit tests, and the production build.
- `npm run test:e2e` passed both built and development Electron smoke tests using npm's local executable resolution.
- `npm audit` reported 12 moderate findings in the development lint dependency chain, including the transitive minimatch denial-of-service advisory. `npm audit --omit=dev` reported zero findings. No automatic fixes or dependency upgrades were applied; review the lint toolchain advisories separately before accepting the foundation. Remote CI and other developers' onboarding remain unverified.

The owner subsequently installed Node.js 26.13.0 and npm 11.20.0 and authorized updating the development requirements to match. `.node-version`, package engines, package-manager metadata, and the Windows CI setup now target these versions. The old portable Node.js 24 runtime in `.tools/` is historical tooling and no longer satisfies the project requirements. Use the system installation in a newly opened terminal; remove any old portable-runtime prefix from an existing terminal's PATH or reopen it.

The `@types/node` 24 pin remains aligned with the Electron main/preload runtime; changing the host development runtime does not change Electron's embedded Node.js runtime or validate future native dependencies.

Runtime-upgrade validation on November 1, 2026 used the system binaries in `C:\Program Files\nodejs` (Node.js 26.13.0 and npm 11.20.0), with no portable runtime prefix:

- Lockfile root engine metadata updated; direct application dependencies were unchanged.
- `npm ci` passed, including Electron installation.
- `npm run check` passed: strict types, lint, formatting, three unit tests, and build.
- `npm run test:e2e` passed both built and development Electron launch tests.
- npm still reported the previously recorded 12 moderate development-tool findings. No audit fixes were applied. The Windows workflow is updated to install the exact npm pin, but has not run remotely.

Review follow-up on November 1, 2026 fixed the test harness's unintended extra Electron launch. `electron-vite dev --rendererOnly` skips desktop builds but still launches the application, so Playwright now uses the Vite CLI with a shared renderer configuration instead. React plugins, loopback settings, and the serve-only CSP transform remain shared with normal desktop development. The node typecheck includes the new configuration file. `npm run check` passed (including three unit tests), and `npm run test:e2e` passed both desktop modes with added checks for the development CSP allowances and the existing strict built-policy check. This follow-up did not reinstall dependencies, rerun npm audit, or run remote CI.

A successful run on this machine does not demonstrate a fresh setup on every developer's Windows machine. Those onboarding confirmations, AV-001 team/hosting decisions, remote CI/protection, and independent human review remain acceptance gaps. AV-002 is prepared for review, not marked Done. Source setup guidance: [electron-vite](https://electron-vite.org/guide/), [npm](https://docs.npmjs.com/cli/v11/commands/npm-ci).
