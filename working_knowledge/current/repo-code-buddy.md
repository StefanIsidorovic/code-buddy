# Repository Notes

## Identity
- name: code-buddy
- path: /home/stefan/code-buddy
- branch: setup

## Architecture
- Tauri v2 application scaffold exists with React/TypeScript frontend and Rust backend entrypoints.
- The product spec recommends Tauri v2, Rust backend, React/TypeScript/Vite frontend, xterm.js, Zustand, SQLite, keyring, and portable-pty.
- Rust backend modules now separate domain types, errors, adapter registry, SQLite storage, keyring secrets, Tauri commands, and app state.
- AGENTS.md resolver implements nearest-file-wins lookup from session cwd to project root and adapter-driven delivery strategies.
- PTY session orchestration uses portable-pty with one running child per session, reader threads for streamed output, writer handles for input, resize support, and forced cleanup on manager drop.
- Structured event parsing uses per-session AgentOutputParser instances so partial JSONL reads are buffered independently for each running session.
- Frontend modules now separate typed Tauri API wrappers, shared TS domain types, Zustand runtime state, and componentized sidebar/topbar/terminal/chat/details surfaces.
- README documents Linux-first setup, validation, architecture, security notes, and provenance workflow.

## Entry Points
- Frontend entry: src/main.tsx renders src/App.tsx.
- Backend entry: src-tauri/src/main.rs calls code_buddy_lib::run().
- Tauri command: app_status returns "ready" for baseline backend validation.
- Initial IPC commands: list_agents, list_projects, create_project, get_transcript, set_secret, has_secret.
- AGENTS.md IPC commands: resolve_agents_md and create_agents_md.
- Session IPC commands: start_session, write_input, write_raw, resize_session, stop_session.
- Session events: session:output, session:event, session:state.
- Frontend API wrapper: src/lib/api.ts maps Tauri commands/events to typed functions.

## Tests
- Frontend: Vitest + Testing Library; baseline App shell render test.
- Frontend component tests now mock the Tauri API and cover bootstrap, project creation, session start request mapping, prompt dispatch, and streamed output updates.
- Backend: cargo test covers app_status, adapter command construction, registry lookup errors, SQLite project/config/message CRUD, missing path rejection, memory secret store behavior, empty secret rejection, and redaction.
- PTY tests cover fake session streaming/input, resize validation, force stop removal, killed-state regression, invalid cwd rejection, and 8 concurrent fake sessions.
- Structured parser tests cover Codex, Claude, and Kimi JSONL fixtures, malformed JSON warnings, partial-line buffering, and Codex user-role mapping.

## Current Findings
- AGENTS.md defines a strict research, planning, implementation, testing, review, commit, and provenance workflow.
- working_knowledge directories and templates were missing at session start despite being required by AGENTS.md.
- .gitignore excludes working_knowledge, secrets, tools, .codex, .idea, and .git.
- Node 24.13.0 and npm 11.6.2 are installed.
- rustc and cargo are installed under ~/.cargo/bin; source ~/.cargo/env before Rust/Tauri commands in this shell.
- Tauri Linux dependencies installed: webkit2gtk-4.1, javascriptcoregtk-4.1, gtk+-3.0, libxdo-dev, libayatana-appindicator3-dev, librsvg2-dev.
- Ubuntu libxdo-dev provides /usr/include/xdo.h and /usr/lib/x86_64-linux-gnu/libxdo.so but no xdo.pc.
- .gitignore now ignores node_modules, dist, and src-tauri/target while allowing working_knowledge to be tracked.
- Adapter command tests use binary_path overrides so they do not require real CLIs to be installed.
- Codex and Claude adapters use Native AGENTS.md delivery; Kimi uses PrependToPrompt.
- Installed agent CLIs: Codex CLI 0.128.0, Claude Code 2.1.201, Kimi 1.44.0.
- Verified local help: Codex supports exec --json; Claude supports --print with stream-json and partial messages; Kimi supports --print with stream-json.
- Force-stopped sessions are removed before the reader thread reports process exit, preventing killed sessions from reverting to exited in the UI.
- SessionManager is intentionally not cloneable; dropping it kills active child sessions for shutdown cleanup.
- UI start blocks missing CLIs, resolves AGENTS.md before launch, and resets headless mode when the selected agent does not support it.
- Tauri identifier is com.codebuddy.desktop.
- Linux packaging validation produced deb, rpm, and AppImage bundles under src-tauri/target/release/bundle/.

## Constraints
- Every implementation plan item must include tests and an adversarial review.
- Every completed implementation plan item must be committed with a provenance git note under refs/notes/provenance.
- The full v1 spec is too large to safely implement as one plan item.
- Tauri validation should source ~/.cargo/env before npm/cargo commands.
