# Repository Notes

## Identity
- name: code-buddy
- path: /home/katarina/projects/AIadne
- branch: new/start

## Architecture
- Current scaffold is a Tauri v2 desktop app with a Rust backend and React/TypeScript/Vite frontend.
- Frontend now renders a minimal PTY test panel for AIA-002 manual validation.
- Frontend has Start Fake and Start Codex controls; Start Codex is a temporary smoke-test path.
- PTY output is rendered through xterm.js with FitAddon instead of a raw pre block.
- PTY output scroll is constrained to the xterm viewport; the desktop page itself is viewport-bound.
- PTY input now uses xterm onData to write raw keyboard data into write_session_input; the old line-send HTML input was removed.
- Session start and manual Resize use the fitted xterm cols/rows so Codex draws to the visible terminal size.
- Backend exposes the Tauri run entry, app_status, AIA-002 PTY commands, and the temporary Codex command.
- Backend now has an AIA-003 adapter boundary in src-tauri/src/adapters.rs.
- Older product feature modules for SQLite storage, keyring secrets, AGENTS.md resolution, domain types, and app state were removed locally; a new focused adapter boundary now exists for AIA-003.
- AIA-002 adds backend-only PTY session orchestration with a fake CLI; real agent adapters remain out of scope.
- SessionManager stores PTY sessions, bounded output buffers, child handles, and resize/write/stop operations.
- AgentRegistry lists compiled-in codex, claude_code, and kimi adapter metadata.
- Codex smoke-test command construction now goes through CodexAdapter.

## Entry Points
- Frontend entry: src/main.tsx renders src/App.tsx.
- Backend entry: src-tauri/src/main.rs calls code_buddy_lib::run().
- Baseline backend command: app_status.
- AIA-002 backend commands: start_fake_session, write_session_input, resize_session, stop_session, drain_session_output, list_sessions.
- Temporary Codex backend command: start_codex_session.
- Adapter module: src-tauri/src/adapters.rs defines AgentAdapter, AgentRegistry, BinaryResolver, AgentCommand, AgentInput, and structured parse hook types.

## Tests
- Frontend: Vitest + Testing Library via src/App.test.tsx.
- Frontend test mocks @tauri-apps/api/core and checks PTY panel controls.
- Frontend test mocks @xterm/xterm and @xterm/addon-fit.
- Backend: cargo test covers the minimal app_status command.
- AIA-002 backend tests cover fake session start/output, input, resize, stop, force stop, cleanup, missing session errors, and 8-session concurrency.
- AIA-003 backend tests cover adapter registry list/resolve/default, missing adapter, fake resolver detection, Codex command construction, input encoding, capability edge cases, and structured hook fallback.

## Current Findings
- AGENTS.md requires research, plan, tests, adversarial review, one commit per plan item, and provenance notes.
- AGENTS.md requires mind_map.md and mind_map/ to be maintained when an active mind map exists.
- working_knowledge was stale and has been regenerated for the reset task.
- HEAD c51b78a has a provenance note under refs/notes/provenance.
- docs/linear-tasks.md contains 16 task drafts mapped to the restart build plan.
- README documents the reset skeleton and validation commands.
- portable-pty 0.9.0 docs confirm native_pty_system/openpty, spawn_command, reader/writer handles, resize, try_wait, and kill APIs.
- portable-pty 0.9.0 was added to Cargo.toml and Cargo.lock.
- Validation passed: cargo test, cargo clippy -- -D warnings, npm run typecheck, npm run test -- --run, npm run build.
- Manual PTY UI validation should use npm run tauri dev; browser-only Vite mode cannot call Tauri backend commands.
- Local Codex CLI check: codex-cli 0.142.5; help supports interactive mode, --cd, and --no-alt-screen.
- npm build succeeds with a non-fatal >500 kB chunk warning after adding xterm.
- Frontend validation now includes a test that xterm keyboard data is forwarded to write_session_input for the active session.
- Active mind map files now cover PTY runtime, frontend terminal, adapter boundary, and agent launch flow.

## Constraints
- Keep reset narrow: no new product functionality in this pass.
- Use apply_patch for manual file edits.
- User will commit after reviewing local changes.
- Linux-first fake CLI is implemented with /bin/sh; Windows placeholder needs later hardening.
- Start Codex depends on codex being available on PATH in the terminal that launches npm run tauri dev.
- xterm dependencies are now in package.json/package-lock.json.
- Keep working_knowledge/current/mind_map.md synchronized with every file under working_knowledge/current/mind_map/.
- Real adapter behavior remains deferred to AIA-005/AIA-006/AIA-007 after checking each CLI help surface.
