# Repository Notes

## Identity
- name: code-buddy
- path: /home/katarina/projects/AIadne
- branch: setup

## Architecture
- Current scaffold is a Tauri v2 desktop app with a Rust backend and React/TypeScript/Vite frontend.
- Frontend renders a static reset skeleton showing the planned stack and build milestones.
- Frontend now renders a minimal PTY test panel for AIA-002 manual validation.
- Backend is reduced to the Tauri run entry and app_status command only.
- Feature modules for adapters, SQLite storage, keyring secrets, AGENTS.md resolution, domain types, and app state were removed locally.
- AIA-002 adds backend-only PTY session orchestration with a fake CLI; real agent adapters remain out of scope.
- SessionManager stores PTY sessions, bounded output buffers, child handles, and resize/write/stop operations.

## Entry Points
- Frontend entry: src/main.tsx renders src/App.tsx.
- Backend entry: src-tauri/src/main.rs calls code_buddy_lib::run().
- Baseline backend command: app_status.
- AIA-002 backend commands: start_fake_session, write_session_input, resize_session, stop_session, drain_session_output, list_sessions.

## Tests
- Frontend: Vitest + Testing Library via src/App.test.tsx.
- Frontend test mocks @tauri-apps/api/core and checks PTY panel controls.
- Backend: cargo test covers the minimal app_status command.
- AIA-002 backend tests cover fake session start/output, input, resize, stop, force stop, cleanup, missing session errors, and 8-session concurrency.

## Current Findings
- AGENTS.md requires research, plan, tests, adversarial review, one commit per plan item, and provenance notes.
- working_knowledge was stale and has been regenerated for the reset task.
- package-lock.json has a pre-existing metadata-only change unrelated to the reset.
- HEAD 74ca850 has no provenance note under refs/notes/provenance.
- docs/linear-tasks.md contains 16 task drafts mapped to the restart build plan.
- README documents the reset skeleton and validation commands.
- portable-pty 0.9.0 docs confirm native_pty_system/openpty, spawn_command, reader/writer handles, resize, try_wait, and kill APIs.
- portable-pty 0.9.0 was added to Cargo.toml and Cargo.lock.
- Validation passed: cargo test, cargo clippy -- -D warnings, npm run typecheck, npm run test -- --run, npm run build.
- Manual PTY UI validation should use npm run tauri dev; browser-only Vite mode cannot call Tauri backend commands.

## Constraints
- Preserve user changes and do not revert package-lock.json.
- Keep reset narrow: no new product functionality in this pass.
- Use apply_patch for manual file edits.
- User will commit after reviewing local changes.
- Linux-first fake CLI is implemented with /bin/sh; Windows placeholder needs later hardening.
