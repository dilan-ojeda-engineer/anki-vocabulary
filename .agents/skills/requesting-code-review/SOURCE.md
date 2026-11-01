# Upstream source

- Repository: https://github.com/obra/superpowers
- Revision: `2ce8aa15d05bd57213e6f746f953aafb7ded7a8b`
- Skill path: `skills/requesting-code-review`
- Installed: November 1, 2026, at the project owner's request.
- Scope: this skill and its reviewer template only; no Superpowers hooks, other skills, or global configuration were installed.
- License: MIT; upstream copyright and permission notice are preserved in `LICENSE`.

`SKILL.md` and `code-reviewer.md` are unchanged upstream files. `LICENSE` is copied from the repository root at the same revision. All three were byte-verified against the raw files at that revision. `SOURCE.md` is the project's provenance record, not an upstream file.

| File | SHA256 |
| --- | --- |
| `SKILL.md` | `2180e14a448e9410bec88e6646a2d1f0ce7fdd58de27388c1e052e929679d2bc` |
| `code-reviewer.md` | `82e370be6b3447523816286195571e4216ba56ba1ad6ad0e87862294c4c78dcb` |
| `LICENSE` | `a37e0e9697144819e1d965176ac4ae5bc3fa02d11e7812036bbcadf6dafe2400` |

Use the skill through project-local skill discovery. Its instructions dispatch a separate reviewer with focused requirements and a Git range. Project instructions and the user's authorized scope take precedence; human peer approval, commit authorization, and board acceptance remain governed by `CONTRIBUTING.md` and `AGENTS.md`.

To update, review an explicit new upstream revision, replace the two upstream files and license together using the skill-installer workflow, verify their hashes, and update this record. Do not silently follow `main`. Automatic formatting excludes this directory to preserve the vendored instructions and license.
