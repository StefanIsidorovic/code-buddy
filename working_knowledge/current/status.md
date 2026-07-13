# Status

## Session
- session_id: codex-20260713T103139Z
- date_utc: 2026-07-13
- agent_model: codex

## Target Repositories
- code-buddy: /home/katarina/projects/AIadne

## Repository State
- branch: new/start
- head: e45971f step 28-29: make ACP primary and add multi-repo projects
- worktree: local AIA-036/AIA-037/AIA-038/AIA-039/AIA-040/AIA-044/AIA-045/AIA-046/AIA-047 changes validated and awaiting user review/manual commit.
- relevant files: Tauri v2 + React/Vite scaffold; Rust backend has app_status, PTY session commands, adapter registry/types, agent doctor reports, ACP stdio session commands, ACP registry discovery/launch, Codex ACP runtime hardening, SQLite project/repository/transcript/knowledge storage, transcript rename support, project initialization preflight/facts storage, and Tauri dialog plugin wiring.

## Current Task
- request: continue Project Initialize phases and show how to test them.
- phase: validated; awaiting user review/manual commit
- active plan step: 38 complete

## Risks And Constraints
- AIA-002, Codex xterm smoke test, mind map, AIA-003 adapter boundary, AIA-004 doctor detection, AIA-017 ACP stdio fake runtime, AIA-018 ACP registry discovery, and AIA-019 selected ACP launch are committed through 1ce5f36.
- AIA-020/AIA-021 are committed in b0f845d.
- AIA-022 workspace persistence is committed as a319c23.
- AIA-023/AIA-024 were committed together by user as 113bee7.
- AIA-025 through AIA-030 are committed through 4a43282.
- AIA-031/AIA-032/AIA-033 were committed together as 327e05c.
- AIA-034/AIA-035 were committed together as e45971f.
- AIA-036 full-width app shell/sidebar layout is implemented and validated locally on top of e45971f.
- AIA-037 output visibility and ACP waiting-state bugfix is implemented and validated locally on top of the AIA-036 diff.
- AIA-038 Knowledge Card popup creation is implemented and validated locally on top of the AIA-036/AIA-037 diff.
- AIA-039 Project Initialize preflight is implemented locally on top of AIA-036/AIA-037/AIA-038.
- AIA-040 Project Initialize facts collection is implemented locally on top of AIA-039/AIA-047.
- AIA-044 Project delete confirmation is implemented locally on top of AIA-039.
- AIA-045 native project folder picker, delete success message, and active runtime cwd display are implemented locally on top of AIA-044.
- AIA-046 stop running ACP sessions before project deletion is implemented locally on top of AIA-045.
- AIA-047 transient Workspace toast notifications are implemented locally on top of AIA-046.
- User explicitly asked the agent not to commit; user committed reviewed changes manually.
- portable-pty 0.9.0 was fetched previously with approved cargo network access.
- Active mind map files must be updated when PTY runtime, frontend terminal, adapter boundary, or agent launch flow knowledge changes.
- Active mind map now also includes ACP transport knowledge.
- LOCAL_PROGRESS.md is intentionally ignored by git and maintained as a local human-readable progress log.
- Project storage currently persists project name/path, ACP transcript history with user-editable titles, and local Knowledge Cards; automatic suggestions, embeddings, conflict review, and delete/detach UI are deferred.
- Project storage now treats `projects.path` as the legacy/default launch folder and adds child repository rows for multi-repository projects.
- Project Initialize is project-scoped; selected repositories are chosen by the user and persisted per initialization run before later analysis phases run.
- Project Initialize Facts collects deterministic local metadata only for repositories selected in the initialization run; markdown analysis, interview guardrails, and summary approval remain deferred.
- Project deletion uses existing backend delete_project semantics: project repositories and initialization runs are removed with the project; saved transcripts are kept without the project link.
- Running PTY/ACP sessions keep the cwd they were launched with even if the saved project is later deleted; runtime info now exposes that active cwd explicitly.
- Project delete now stops all running ACP sessions first so deleted projects do not leave live ACP agents running in old project folders.

## Last Verification
- 2026-07-13T14:39:07Z: AIA-040 final validation passed: npm run typecheck; npm run test -- --run (25 frontend tests); npm run build; cargo fmt --check; cargo test (49 Rust tests); cargo clippy -- -D warnings; git diff --check. Review added manifest/test/entry-point facts before final validation. Vite still reports expected xterm chunk-size warning; cargo emitted non-fatal stream fd warnings in the sandbox.
- 2026-07-13T14:23:58Z: AIA-047 final validation passed: npm run typecheck; npm run test -- --run (24 frontend tests); npm run build; cargo fmt --check; cargo test (47 Rust tests); cargo clippy -- -D warnings; git diff --check. Review added manual-dismiss coverage after the first pass and found no remaining issues. Vite still reports expected xterm chunk-size warning; cargo emitted non-fatal stream fd warnings in the sandbox.
- 2026-07-13T14:08:34Z: AIA-046 final validation passed: cargo fmt --check; cargo test (47 Rust tests); cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run (22 frontend tests); npm run build; git diff --check. Review found no remaining issues. Vite still reports expected xterm chunk-size warning; cargo emitted non-fatal stream fd warnings in the sandbox.
- 2026-07-13T13:56:10Z: AIA-045 final validation passed: cargo fmt --check; cargo test (47 Rust tests); cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run (22 frontend tests); npm run build; git diff --check. Review found no remaining issues. Vite still reports expected xterm chunk-size warning; cargo emitted non-fatal stream fd warnings in the sandbox.
- 2026-07-13T13:33:05Z: AIA-044 final validation passed: cargo fmt --check; cargo test (47 Rust tests); cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run (21 frontend tests); npm run build; git diff --check. Review found no remaining issues. Vite still reports expected xterm chunk-size warning; cargo emitted non-fatal stream fd warnings in the sandbox.
- 2026-07-13T13:22:19Z: AIA-039 final validation passed: cargo fmt --check; cargo test (47 Rust tests); cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run (20 frontend tests); npm run build; git diff --check. Review found and fixed stale Project Initialize status when switching projects. Vite still reports expected xterm chunk-size warning; cargo emitted non-fatal stream fd warnings in the sandbox.
- 2026-07-13T12:11:29Z: AIA-038 validation passed: npm run typecheck; npm run test -- --run (18 frontend tests); npm run build; cargo test (45 Rust tests); cargo clippy -- -D warnings; git diff --check. Review found and fixed popup-local error display before final validation. Vite still reports expected xterm chunk-size warning; cargo emitted non-fatal stream fd warnings in the sandbox.
- 2026-07-13T11:52:04Z: AIA-037 validation passed: npm run typecheck; npm run test -- --run (18 frontend tests); npm run build; cargo test (45 Rust tests); cargo clippy -- -D warnings; git diff --check. Review found no remaining issues. Vite still reports expected xterm chunk-size warning; cargo emitted non-fatal stream fd warnings in the sandbox.
- 2026-07-13T11:43:06Z: AIA-036 final validation passed: npm run typecheck; npm run test -- --run (17 frontend tests); npm run build; cargo test (45 Rust tests); cargo clippy -- -D warnings; git diff --check. Adversarial review found no required fixes. Vite still reports expected xterm chunk-size warning; cargo emitted non-fatal stream fd warnings in the sandbox.
- 2026-07-13T11:38:42Z: AIA-036 research inspected screenshot references, git status/log, App.tsx sidebar/runtime markup, App.css shell/sidebar layout, App.test.tsx render expectations, and frontend-terminal mind map.
- 2026-07-13T11:10:24Z: AIA-035 final validation passed: cargo fmt --check; cargo test (45 Rust tests); cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run (17 frontend tests); npm run build; git diff --check. Vite still reports expected xterm chunk-size warning; cargo emitted non-fatal stream fd warnings in the sandbox.
- 2026-07-13T10:50:00Z: researched current ProjectStore, project commands, Workspace frontend, launch cwd wiring, frontend tests, README, Linear tasks, and workspace-persistence mind map for multi-repository project support.
- 2026-07-13T10:34:28Z: AIA-034 revalidation passed: npm run typecheck; npm run test -- --run (16 frontend tests); npm run build; git diff --check; cargo test (43 Rust tests); cargo clippy -- -D warnings. Vite still reports expected xterm chunk-size warning; cargo emitted non-fatal stream fd warnings in the sandbox.
- 2026-07-13T10:31:39Z: session continuation inspected git status, active working knowledge, templates, AIA-034 local diff, and recent commits; AIA-034 remains local and uncommitted on top of 327e05c.
- 2026-07-10T11:59:32Z: session initialization inspected git status, active working knowledge, mind map index, recent commits, and local diff summary; AIA-031 remains implemented locally and uncommitted.
- 2026-07-07T13:38:03Z: c51b78a committed with provenance note for Codex xterm PTY smoke test.
- 2026-07-04T23:41:00Z: validation passed for PTY/xterm work: npm run typecheck; npm run test -- --run; npm run build; cargo test; cargo clippy -- -D warnings.
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
- 2026-07-09T11:16:38Z: AIA-022 workspace persistence validated: cargo fmt --check; cargo test; cargo clippy -- -D warnings; tsc --noEmit; vitest run; vite build; git diff --check. Rust tests: 37 passed. Frontend tests: 11 passed. Vite still reports expected xterm chunk-size warning.
- 2026-07-09T12:57:13Z: AIA-023 runtime UI polish validated after mode-specific output change: tsc --noEmit; vitest run; vite build; git diff --check. Frontend tests: 11 passed. Vite still reports expected xterm chunk-size warning.
- 2026-07-09T13:21:32Z: AIA-024 interim validation passed: cargo fmt --check; cargo test; npm run typecheck; npm run test -- --run. Rust tests: 40 passed. Frontend tests: 12 passed.
- 2026-07-09T13:25:56Z: AIA-024 final validation passed: cargo fmt --check; cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build; git diff --check. Rust tests: 40 passed. Frontend tests: 12 passed. Vite still reports expected xterm chunk-size warning.
- 2026-07-09T13:46:08Z: AIA-025 saved transcript replay validated: npm run typecheck; npm run test -- --run; npm run build; cargo test; cargo clippy -- -D warnings; git diff --check. Rust tests: 40 passed. Frontend tests: 12 passed. Vite still reports expected xterm chunk-size warning.
- 2026-07-09T14:17:44Z: AIA-026 transcript selection/sidebar refinement validated: npm run typecheck; npm run test -- --run; npm run build; cargo test; cargo clippy -- -D warnings; git diff --check. Rust tests: 40 passed. Frontend tests: 12 passed. Vite still reports expected xterm chunk-size warning.
- 2026-07-09T14:46:38Z: AIA-026 sidebar history/accordion refinement validated: npm run typecheck; npm run test -- --run; npm run build; cargo test; cargo clippy -- -D warnings; git diff --check. Rust tests: 40 passed. Frontend tests: 12 passed. Vite still reports expected xterm chunk-size warning.
- 2026-07-09T15:12:03Z: AIA-027 saved transcript chat normalization validated: npm run typecheck; npm run test -- --run; npm run build; cargo test; cargo clippy -- -D warnings; git diff --check. Rust tests: 40 passed. Frontend tests: 13 passed. Vite still reports expected xterm chunk-size warning.
- 2026-07-09T15:43:27Z: AIA-028 ACP output autoscroll and stable transcript drain validated: npm run typecheck; npm run test -- --run; npm run build; cargo test; cargo clippy -- -D warnings; git diff --check. Rust tests: 40 passed. Frontend tests: 13 passed. Vite still reports expected xterm chunk-size warning.
- 2026-07-09T15:54:30Z: AIA-029 pastel runtime UI polish validated: npm run typecheck; npm run test -- --run; npm run build; cargo test; cargo clippy -- -D warnings; git diff --check. Rust tests: 40 passed. Frontend tests: 13 passed. Vite still reports expected xterm chunk-size warning.
- 2026-07-09T16:11:27Z: AIA-030 reference earth palette and typography polish validated: npm run typecheck; npm run test -- --run; npm run build; git diff --check. Frontend tests: 13 passed. Vite still reports expected xterm chunk-size warning.
- 2026-07-10T11:49:16Z: AIA-031 manual Knowledge Cards validated: cargo fmt --check; cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build; git diff --check. Rust tests: 42 passed. Frontend tests: 14 passed. Vite still reports expected xterm chunk-size warning.
- 2026-07-10T12:03:46Z: AIA-032 ACP waiting UX validated: npm run typecheck; npm run test -- --run; npm run build; git diff --check. Frontend tests: 14 passed. Vite still reports expected xterm chunk-size warning.
- 2026-07-10T12:19:32Z: AIA-033 Session History filter/rename validated: cargo fmt --check; cargo test; cargo clippy -- -D warnings; npm run typecheck; npm run test -- --run; npm run build; git diff --check. Rust tests: 43 passed. Frontend tests: 15 passed. Vite still reports expected xterm chunk-size warning.
- 2026-07-10T12:41:44Z: AIA-033 compact Session History list fix validated: npm run typecheck; npm run test -- --run; npm run build; git diff --check. Frontend tests: 16 passed. Vite still reports expected xterm chunk-size warning.
- 2026-07-10T13:44:57Z: AIA-034 Terminal PTY fallback UI and top-right Runtime Controls info card validated: npm run typecheck; npm run test -- --run; npm run build; git diff --check. Frontend tests: 16 passed. Vite still reports expected xterm chunk-size warning.
