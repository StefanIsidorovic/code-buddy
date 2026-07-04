# Handoff

## Current State
- Repository research for AIA-002 is complete.
- working_knowledge/current is focused on the PTY session core task.
- Frontend mock functionality and backend feature modules have been removed locally from the previous reset task.
- README documents the reset skeleton.
- docs/linear-tasks.md contains 16 Linear-ready task drafts, including AIA-002.
- AIA-002 is implemented locally: portable-pty dependency, SessionManager, fake PTY CLI, Tauri commands, and backend tests.
- Minimal Tauri frontend PTY test panel is implemented locally.
- package-lock.json has a pre-existing metadata-only modification.
- HEAD is 74ca850 and lacks a provenance note under refs/notes/provenance.
- User requested no agent commit; changes remain local for user review.

## Next Step
- User runs npm run tauri dev, tests the PTY panel, reviews local changes, and commits if satisfied.

## Commands To Re-Run
- git status --short --branch: confirm dirty files before editing.
- rg --files: confirm source tree after deleting feature modules.
- npm run typecheck: validate TypeScript.
- npm run test -- --run: validate frontend tests.
- npm run build: validate Vite build.
- cargo test: validate Rust backend skeleton.
- cargo clippy -- -D warnings: validate Rust lint status.
- npm run tauri dev: launch the desktop PTY test panel.

## Watchouts
- Do not revert the pre-existing package-lock.json change.
- No fake agent sessions, mock project data, storage/secrets commands, or AGENTS.md resolver code remain in the reset skeleton.
- This session intentionally skipped commits and provenance notes because the user asked to commit after review.
- portable-pty 0.9.0 was fetched and Cargo.lock changed.
- The Windows fake command is a placeholder; local validation is Linux-first.
- The PTY panel backend calls work in Tauri runtime, not a normal browser tab.
