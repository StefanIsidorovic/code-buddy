# Handoff

## Current State
- Repository research for AIA-002 is complete.
- working_knowledge/current is focused on the PTY session core task.
- Frontend mock functionality and backend feature modules have been removed locally from the previous reset task.
- README documents the reset skeleton.
- docs/linear-tasks.md contains 16 Linear-ready task drafts, including AIA-002.
- AIA-002 is implemented locally: portable-pty dependency, SessionManager, fake PTY CLI, Tauri commands, and backend tests.
- Minimal Tauri frontend PTY test panel is implemented locally.
- Temporary Codex PTY launch path is implemented locally for manual smoke testing.
- PTY output panel now uses xterm.js instead of raw preformatted text.
- PTY test panel no longer creates page-level infinite scroll; terminal output scrolls inside the xterm viewport.
- PTY keyboard input now flows through xterm onData directly into write_session_input; the separate HTML input field was removed.
- Sessions now start with the fitted xterm size, and the Resize button syncs the current terminal size to the backend PTY.
- Active mind map exists: working_knowledge/current/mind_map.md indexes pty-runtime, frontend-terminal, and agent-launch-flow topic files.
- AIA-003 is implemented locally: AgentAdapter trait, AgentRegistry, built-in codex/claude_code/kimi metadata, test fake adapter, and adapter unit tests.
- Temporary Codex launch now uses CodexAdapter for detection and command construction.
- Frontend active-session ref is updated synchronously after start/resize/stop so immediate xterm input is not dropped.
- AIA-004 is implemented locally: backend doctor reports, version lookup timeout, Tauri command, Agent Doctor UI, and Codex start blocking when missing/error.
- LOCAL_PROGRESS.md exists as a git-ignored human-readable local diary; .gitignore has the tracked ignore rule.
- HEAD is 8cdd5f5.
- User requested no agent commit; changes remain local for user review.

## Next Step
- User reviews AIA-004 local changes and commits if satisfied; next backlog task is the first full real-agent adapter path.

## Commands To Re-Run
- git status --short --branch: confirm dirty files before editing.
- rg --files: confirm source tree after deleting feature modules.
- npm run typecheck: validate TypeScript.
- npm run test -- --run: validate frontend tests.
- npm run build: validate Vite build.
- cargo test: validate Rust backend skeleton.
- cargo clippy -- -D warnings: validate Rust lint status.
- npm run tauri dev: launch the desktop PTY test panel.
- In the Tauri app, check Agent Doctor for Codex/Claude/Kimi installed/missing/error states.
- rg --files working_knowledge/current: verify mind map files are present.

## Watchouts
- No fake agent sessions, mock project data, storage/secrets commands, or AGENTS.md resolver code remain in the reset skeleton.
- This session intentionally skipped commits and provenance notes because the user asked to commit after review.
- portable-pty 0.9.0 was fetched and Cargo.lock changed.
- The Windows fake command is a placeholder; local validation is Linux-first.
- The PTY panel backend calls work in Tauri runtime, not a normal browser tab.
- Start Codex uses codex --no-alt-screen --cd <cwd>; full adapter behavior is still deferred.
- AIA-003 does not validate real Claude Code, Codex, or Kimi CLI flags beyond the existing Codex smoke path; those checks belong to AIA-005/AIA-006/AIA-007.
- AIA-004 uses generic `--version` readiness checks; real adapter tasks can refine per-CLI detection after help/version validation.
- @xterm/xterm and @xterm/addon-fit are installed; npm build reports a non-fatal chunk-size warning.
- The page shell is viewport-bound; long output should scroll inside xterm, not the whole desktop page.
- For Codex, do not use a separate prompt input; click/focus the terminal and type directly so Enter/control keys reach the TUI.
- Keep working_knowledge/current/mind_map.md and working_knowledge/current/mind_map/* updated when PTY runtime, frontend terminal, adapter boundary, or agent launch flow changes.
