# Agent Launch Flow

## Sources
- src-tauri/src/session.rs
- src-tauri/src/adapters.rs
- src-tauri/src/commands.rs
- src/App.tsx
- README.md
- docs/linear-tasks.md

## Current Shape
- Fake CLI is the reliable test target for AIA-002.
- Codex CLI launch is still a temporary smoke-test path, but command construction now goes through CodexAdapter.
- The frontend chooses fake or Codex by invoking start_fake_session or start_codex_session.
- Backend command registration exposes both launch paths through Tauri.

## Fake CLI Flow
- start_fake_session resolves cwd and PTY size.
- Unix fake command starts /bin/sh and prints fake-ready.
- Fake command echoes each input line as fake:<line>.
- Fake session is used by backend tests and manual UI testing.

## Codex Flow
- start_codex_session resolves cwd and PTY size.
- codex_command uses CodexAdapter detection and command construction.
- Codex is launched with --no-alt-screen and --cd <cwd>.
- command.cwd(cwd) is also set on the spawned process.
- xterm is required because Codex emits ANSI/TUI output and expects terminal keyboard input.

## Boundaries
- AgentAdapter abstraction exists for detection, capabilities, command construction, input encoding, structured parsing hook, and AGENTS.md delivery strategy.
- AgentRegistry can list and resolve compiled-in Codex, Claude Code, and Kimi adapters.
- No project/session persistence is connected to launches.
- No keychain or API-key management is connected to launches.
- No per-project cwd picker exists yet; cwd defaults to the backend process current directory.
- Start Codex depends on codex being available on PATH in the environment that launches npm run tauri dev.

## Deferred Work
- Replace temporary start_codex_session with the full adapter-driven session start path from later Linear tasks.
- Add explicit workspace/project cwd selection before launching real agents.
- Add event-streamed PTY output instead of drain polling.
- Decide how agent install checks, version checks, and PATH diagnostics should appear in the final UI.
