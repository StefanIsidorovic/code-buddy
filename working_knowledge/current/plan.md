# Plan

## Active Plan

### 1. Track workflow state and scaffold the app shell
- objective: make required working_knowledge files versioned and create the Tauri v2 + React/TypeScript foundation.
- status: complete
- files: .gitignore; package.json; package-lock.json; index.html; tsconfig.json; tsconfig.node.json; vite.config.ts; src/*; src-tauri/Cargo.toml; src-tauri/build.rs; src-tauri/tauri.conf.json; src-tauri/capabilities/default.json; src-tauri/src/lib.rs; src-tauri/src/main.rs; working_knowledge/current/*; working_knowledge/templates/*
- affected units: repository ignore rules, npm workspace, Vite app entry, Tauri app entry, initial React layout.
- expected changes: stop ignoring working_knowledge; scaffold a Tauri v2 React app; add initial shell UI with sidebar/main/right panel placeholders; add baseline npm/Rust scripts.
- acceptance criteria: working_knowledge files are trackable; app compiles as a scaffold; initial UI renders without runtime errors.
- required tests: npm run typecheck; npm run test -- --run; npm run build; cargo test from src-tauri.
- review status: passed
- commit: 6208716

### 2. Add backend domain, config persistence, secrets, and adapter registry
- objective: implement core Rust data structures and storage boundaries before process orchestration.
- status: complete
- files: src-tauri/Cargo.toml; src-tauri/src/lib.rs; src-tauri/src/domain.rs; src-tauri/src/errors.rs; src-tauri/src/state.rs; src-tauri/src/storage.rs; src-tauri/src/secrets.rs; src-tauri/src/adapters/mod.rs; src-tauri/src/adapters/codex.rs; src-tauri/src/adapters/claude.rs; src-tauri/src/adapters/kimi.rs; src-tauri/src/adapters/fake.rs; src-tauri/src/commands.rs; src-tauri/src/tests/*
- affected units: Project, AgentId, SessionConfig, AgentEvent, Message, Detection, Capabilities, CommandSpec, AgentAdapter, ConfigStore, SecretStore.
- expected changes: add SQLite-backed projects/config/messages store; add keyring-backed secret store with redaction helpers; add adapter detection/build_command/encode_input/parse_chunk foundations for Codex, Claude, Kimi, and fake test adapter.
- acceptance criteria: backend can list agents, detect installed CLIs, create/list projects, persist config/messages, store/check secrets without plaintext database writes.
- required tests: adapter command unit tests for success/failure/edge cases; storage migration and CRUD tests; secret redaction tests.
- review status: passed
- commit: pending

### 3. Implement AGENTS.md resolution and delivery strategy
- objective: apply project instructions uniformly across native and non-native agents.
- status: in_progress
- files: src-tauri/src/agents_file.rs; src-tauri/src/adapters/mod.rs; src-tauri/src/adapters/codex.rs; src-tauri/src/adapters/claude.rs; src-tauri/src/adapters/kimi.rs; src-tauri/src/commands.rs; src-tauri/src/tests/fixtures/agents_md/*
- affected units: AgentsFileResolution, AgentsFileDelivery, adapter capability declarations, session config preparation.
- expected changes: implement nearest-file-wins collection from cwd to project root; expose Native, InstructionsFlag, and PrependToPrompt strategies; add create-template helper and reload-needed metadata.
- acceptance criteria: backend resolves nested AGENTS.md files deterministically; native readers are not double-injected; Kimi/fake non-native delivery prepends or flags instructions once.
- required tests: nearest-file-wins success; no-file fallback; parent/child precedence; native non-injection; non-native idempotent injection edge cases.
- review status: not_started
- commit: none

### 4. Implement PTY session manager and IPC surface
- objective: launch, stream, resize, write to, stop, and clean up concurrent CLI sessions.
- status: pending
- files: src-tauri/Cargo.toml; src-tauri/src/session.rs; src-tauri/src/commands.rs; src-tauri/src/events.rs; src-tauri/src/state.rs; src-tauri/src/tests/fake_cli.rs; src-tauri/src/tests/*
- affected units: SessionManager, SessionHandle, SessionState, reader task, writer handle, Tauri commands, Tauri events.
- expected changes: use portable-pty for per-session PTY; emit session:output, session:event, and session:state events; coalesce output chunks; implement graceful stop then force kill; kill children on shutdown.
- acceptance criteria: fake CLI sessions start, stream output, accept input, resize, stop, and leave no live child; at least 8 fake sessions run without cross-interference.
- required tests: PTY integration success/failure/edge cases; resize test; graceful/force kill tests; concurrent session test; orphan check test.
- review status: not_started
- commit: none

### 5. Build the desktop UI and frontend state
- objective: expose the multi-agent control surface in React with terminal and structured views.
- status: pending
- files: package.json; src/main.tsx; src/App.tsx; src/styles.css; src/lib/api.ts; src/lib/types.ts; src/store/appStore.ts; src/components/Sidebar.tsx; src/components/TopBar.tsx; src/components/TerminalPane.tsx; src/components/ChatPane.tsx; src/components/RightPanel.tsx; src/components/CommandBar.tsx; src/components/DoctorPanel.tsx; src/components/AgentsIndicator.tsx; src/test/*
- affected units: project/session store, Tauri invoke wrappers, event subscriptions, xterm lifecycle, chat transcript rendering, config/doctor panels.
- expected changes: add project/session sidebar, tabs, agent/model controls, xterm.js terminal, structured chat/tool-call view, right config/activity panel, prompt/raw input, stop/start controls, AGENTS.md indicator, empty/error/loading states.
- acceptance criteria: UI can create/select project, start fake/agent sessions, stream terminal output, submit prompts, switch terminal/chat views, show detection and AGENTS status, and avoid layout overlap on desktop widths.
- required tests: frontend unit tests for store reducers and API mappers; component tests for empty/error/running states; typecheck and build.
- review status: not_started
- commit: none

### 6. Add real adapter fixtures and structured-event parsing
- objective: normalize structured output for agents that support stream/json modes while preserving terminal fallback.
- status: pending
- files: src-tauri/src/adapters/codex.rs; src-tauri/src/adapters/claude.rs; src-tauri/src/adapters/kimi.rs; src-tauri/src/tests/fixtures/codex_stream.jsonl; src-tauri/src/tests/fixtures/claude_stream.jsonl; src-tauri/src/tests/fixtures/kimi_stream.jsonl; src-tauri/src/tests/*
- affected units: parse_chunk implementations, capabilities, RunMode handling, model flags, approval/sandbox flags, command construction.
- expected changes: parse representative JSONL/stream-json events into AgentEvent; keep raw-output fallback for terminal mode; verify installed CLI flags from local help output; avoid hardcoding unverified secret env names beyond configurable defaults.
- acceptance criteria: Codex, Claude, and Kimi adapters build commands matching installed help; structured fixtures produce normalized messages/tool calls/results/completion; malformed JSON falls back to notices/raw output without panics.
- required tests: parser success/failure/edge fixtures; command construction edge cases; malformed/partial chunk tests.
- review status: not_started
- commit: none

### 7. Hardening, final validation, and packaging readiness
- objective: finish the Linux-first v1 slice with validation, docs, and knowledge updates.
- status: pending
- files: README.md; src-tauri/tauri.conf.json; src-tauri/Cargo.toml; package.json; working_knowledge/current/*
- affected units: documentation, scripts, final config, all previously added modules.
- expected changes: document install/run/test steps; add doctor notes for missing CLIs; run full validation; update working knowledge; verify provenance notes for completed commits.
- acceptance criteria: npm run typecheck, npm run test, npm run build, cargo test, and cargo clippy pass where available; Tauri dev/build reaches compile stage on Linux; each completed plan item has one commit with a provenance note.
- required tests: full frontend/backend test suite; cargo clippy; npm build; manual smoke launch if dev server/app starts cleanly.
- review status: not_started
- commit: none

## Plan Assumptions
- Linux is the acceptance-critical platform for this pass; macOS and Windows portability is preserved through portable-pty and Tauri abstractions but not validated locally.
- Session resume is deferred unless it falls out naturally from adapter command construction.
- Approval UX remains inside each agent's native terminal/structured prompts for this slice; the app does not auto-approve.
- Secrets are stored via keyring and injected only at spawn time; the SQLite store must not persist secret values.
- Codex, Claude, and Kimi CLI behavior is based on installed versions: Codex CLI 0.128.0, Claude Code 2.1.201, Kimi 1.44.0.
