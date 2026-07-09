# Status

## Session
- session_id: codex-20260704T224654Z
- date_utc: 2026-07-04
- agent_model: codex

## Target Repositories
- code-buddy: /home/katarina/projects/AIadne

## Repository State
- branch: new/start
- head: 1ce5f36 step 13: start selected ACP registry candidates
- worktree: local AIA-020 generic selected ACP hardening and AIA-021 Codex ACP runtime hardening changes pending user review/commit; LOCAL_PROGRESS.md remains intentionally ignored.
- relevant files: Tauri v2 + React/Vite scaffold; Rust backend has app_status, PTY session commands, adapter registry/types, agent doctor reports, ACP stdio session commands, ACP registry discovery, and selected ACP registry launch.

## Current Task
- request: keep UI polish for later; harden Codex ACP runtime behavior now.
- phase: validated; awaiting user review/commit
- active plan step: 15

## Risks And Constraints
- AIA-002, Codex xterm smoke test, mind map, AIA-003 adapter boundary, AIA-004 doctor detection, AIA-017 ACP stdio fake runtime, AIA-018 ACP registry discovery, and AIA-019 selected ACP launch are committed through 1ce5f36.
- AIA-020 generic selected ACP hardening is implemented locally but not committed.
- AIA-021 Codex ACP runtime hardening is implemented locally but not committed.
- User explicitly asked the agent not to commit; user committed reviewed changes manually.
- portable-pty 0.9.0 was fetched previously with approved cargo network access.
- Active mind map files must be updated when PTY runtime, frontend terminal, adapter boundary, or agent launch flow knowledge changes.
- Active mind map now also includes ACP transport knowledge.
- LOCAL_PROGRESS.md is intentionally ignored by git and maintained as a local human-readable progress log.

## Last Verification
- 2026-07-07T13:38:03Z: c51b78a committed with provenance note for Codex xterm PTY smoke test.
- 2026-07-04T23:41:xxZ: validation passed for PTY/xterm work: npm run typecheck; npm run test -- --run; npm run build; cargo test; cargo clippy -- -D warnings.
- 2026-07-08T09:52:00Z: active mind map added with pty-runtime, frontend-terminal, and agent-launch-flow topic files; structural validation passed with rg --files, rg mind_map references, and git diff --check.
- 2026-07-08T10:27:27Z: AIA-003 adapter boundary added with AgentAdapter, AgentRegistry, built-in codex/claude_code/kimi metadata, test fake adapter, and Codex smoke command routed through CodexAdapter.
- 2026-07-08T10:27:27Z: validation passed: cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build. Vite still reports expected xterm chunk-size warning.
- 2026-07-08T10:51:08Z: AIA-004 doctor/detection added with backend doctor reports, version timeout, Tauri command, Agent Doctor UI, Codex start blocking, and install guidance placeholders.
- 2026-07-08T10:54:59Z: final validation passed: git diff --check; cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build. Vite still reports expected xterm chunk-size warning.
- 2026-07-08T12:39:26Z: AIA-017 ACP transport spike added to docs/linear-tasks.md and ACP transport mind map added; validation passed with git diff --check and rg reference checks.
- 2026-07-08T13:29:10Z: AIA-017 ACP stdio spike implemented with fake ACP subprocess, JSON-RPC initialize/session/prompt flow, event drain, transport metadata, and ACP Test UI.
- 2026-07-08T13:32:13Z: validation passed: git diff --check; cargo fmt --check; cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build. Vite still reports expected xterm chunk-size warning.
- 2026-07-08T13:47:00Z: AIA-017 committed as 6312803 with provenance note under refs/notes/provenance.
- 2026-07-08T14:17:22Z: AIA-018 frontend checks passed: cargo fmt --check; npm run typecheck; npm run test -- --run.
- 2026-07-08T14:20:38Z: AIA-018 final validation passed: cargo fmt --check; cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build; git diff --check. Vite still reports expected xterm chunk-size warning.
- 2026-07-08T14:39:06Z: ACP Registry selection UX added; validation passed with npm run typecheck, npm run test -- --run, and git diff --check.
- 2026-07-08T14:48:41Z: AIA-019 first validation passed: cargo fmt --check; cargo test; npm run typecheck; npm run test -- --run. Rust tests: 29 passed. Frontend tests: 6 passed.
- 2026-07-08T14:51:23Z: AIA-019 final validation passed: cargo fmt --check; cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build; git diff --check. Vite still reports expected xterm chunk-size warning.
- 2026-07-08T15:03:36Z: manual Codex ACP smoke test started a real Codex ACP session and returned message chunks; follow-up fix merges message chunks, filters technical updates, and runs blocking ACP commands off the UI thread.
- 2026-07-08T15:09:22Z: ACP normalization/responsiveness fix validated: cargo fmt --check; cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build; git diff --check. Rust tests: 30 passed. Frontend tests: 6 passed.
- 2026-07-08T15:13:12Z: AIA-019 committed as 1ce5f36 with provenance note under refs/notes/provenance.
- 2026-07-09T09:25:53Z: AIA-020 direct Codex ACP path was validated but then rejected as the wrong product direction.
- 2026-07-09T09:40:58Z: AIA-020 generic selected ACP hardening validated: cargo fmt --check; cargo test; cargo clippy -- -D warnings; tsc --noEmit; vitest --run; vite build; git diff --check. Rust tests: 30 passed. Frontend tests: 8 passed. Frontend validation used /home/katarina/.nvm/versions/node/v22.22.2/bin/node because node/npm were not on PATH in the tool environment.
- 2026-07-09T10:16:01Z: ACP event normalization bug fixed for Codex agent_thought_chunk and text-array content; validation passed with cargo fmt --check, cargo test, cargo clippy -- -D warnings, tsc --noEmit, vitest --run, vite build, and git diff --check. Rust tests: 31 passed. Frontend tests: 8 passed.
- 2026-07-09T10:30:09Z: AIA-021 Codex ACP runtime hardening validated: cargo fmt --check; cargo test; cargo clippy -- -D warnings; tsc --noEmit; vitest --run; vite build; git diff --check. Rust tests: 34 passed. Frontend tests: 9 passed.
