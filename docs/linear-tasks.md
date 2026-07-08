# Linear Task Drafts

Use these as issue drafts for the AIadne Linear team. Suggested labels are
optional and can be adapted to the team's workflow.

## AIA-001: Verify reset skeleton baseline

Description:
Keep the repository at a clean, buildable baseline before product work resumes.
Confirm that only the Tauri, Rust, React, TypeScript, Vite, and test skeleton
remains.

Acceptance criteria:

- App opens to a non-functional skeleton screen.
- Backend exposes only the minimal `app_status` command.
- No agent adapter, storage, secret, AGENTS.md, session, or terminal runtime code remains.
- `npm run typecheck`, `npm run test -- --run`, `npm run build`, `cargo test`, and `cargo clippy -- -D warnings` pass.

Suggested labels: `foundation`, `desktop`, `frontend`, `backend`

Depends on: none

## AIA-002: Add PTY session core with fake CLI

Description:
Implement the backend process orchestration foundation with a pseudo-terminal
per session. Use a fake or echo CLI first so the runtime can be tested without
real agent dependencies.

Acceptance criteria:

- Backend can start a PTY-backed fake session.
- Frontend or test harness can write input and receive streamed output.
- Resize requests reach the PTY layer.
- Stop first attempts graceful termination, then force-kills after timeout.
- Quitting the app leaves no orphaned child processes.
- At least 8 fake sessions can run without cross-interference.

Suggested labels: `backend`, `pty`, `desktop`

Depends on: AIA-001

## AIA-003: Define agent adapter interface and registry

Description:
Create the adapter boundary that isolates Codex, Kimi, and Claude Code CLI
differences behind one interface.

Acceptance criteria:

- Adapter trait covers detection, capabilities, command construction, input encoding, structured parsing hook, and AGENTS.md delivery strategy.
- Registry can list and resolve compiled-in adapters.
- Fake adapter exists for tests.
- Unit tests cover success, missing adapter, and capability edge cases.

Suggested labels: `backend`, `architecture`, `agents`

Depends on: AIA-002

## AIA-004: Build first-run doctor and CLI detection

Description:
Expose installed CLI status and versions so users know which agents are ready.

Acceptance criteria:

- Backend detection resolves binary path and version for each adapter.
- UI shows installed, missing, and error states.
- Missing CLI state blocks session start and shows install guidance placeholders.
- Detection errors do not crash the app.

Suggested labels: `backend`, `frontend`, `agents`

Depends on: AIA-003

## AIA-005: Implement Claude Code adapter

Description:
Add Claude Code as the first real adapter, starting with interactive PTY mode
and then structured output when available.

Acceptance criteria:

- Current local `claude --help` output is checked before flags are hardcoded.
- Interactive mode starts in the selected project directory.
- Model flag and extra args are supported.
- Structured mode emits normalized assistant, tool, and completion events when available.
- Fixtures cover parser success and malformed output fallback.

Suggested labels: `backend`, `agents`, `claude`

Depends on: AIA-003, AIA-004

## AIA-006: Implement Codex adapter

Description:
Add Codex CLI support after validating the installed command surface.

Acceptance criteria:

- Current local `codex --help` output is checked before flags are hardcoded.
- Interactive mode runs through PTY.
- Headless or exec mode is supported where structured output is available.
- Model and approval/sandbox args can be configured.
- Fixture tests cover normalized events and raw fallback.

Suggested labels: `backend`, `agents`, `codex`

Depends on: AIA-003, AIA-004

## AIA-007: Implement Kimi adapter

Description:
Add Kimi CLI support with a terminal-first fallback if structured mode is not
available.

Acceptance criteria:

- Current local `kimi --help` output is checked before flags are hardcoded.
- Interactive PTY mode works end to end.
- Capabilities accurately report whether headless or structured output exists.
- Non-native AGENTS.md delivery can prepend instructions once per session.
- Tests cover command construction and fallback behavior.

Suggested labels: `backend`, `agents`, `kimi`

Depends on: AIA-003, AIA-004

## AIA-008: Add projects, settings, SQLite persistence, and transcripts

Description:
Persist local projects, sessions, messages, agent config, and app settings.

Acceptance criteria:

- SQLite schema includes projects, sessions, messages, agent_config, and app_settings.
- Project CRUD works from backend commands.
- Session transcripts can be reconstructed from stored messages.
- Interactive terminal scrollback is stored only as capped raw text.
- Storage tests cover migration, CRUD, empty results, and invalid input.

Suggested labels: `backend`, `storage`

Depends on: AIA-002

## AIA-009: Add OS keychain secret storage

Description:
Store API keys in the operating system keychain and inject them only at process
spawn time.

Acceptance criteria:

- Secrets are never stored in SQLite or logs.
- Backend can set, check, read for spawn, and delete secrets.
- Error messages redact configured secret values.
- Tests cover empty secret rejection and redaction.

Suggested labels: `backend`, `security`

Depends on: AIA-008

## AIA-010: Implement AGENTS.md resolution and delivery

Description:
Resolve project instructions using nearest-file-wins semantics and apply them
consistently across native and non-native adapters.

Acceptance criteria:

- Resolver walks from session cwd up to project root and orders parent context before child context.
- Native readers are not double-injected.
- Non-native agents receive instructions through adapter-selected delivery.
- UI exposes active, not found, and injected states.
- File change during a session prompts for reload instead of silent reinjection.

Suggested labels: `backend`, `frontend`, `agents`

Depends on: AIA-003, AIA-008

## AIA-011: Build main desktop workspace UI

Description:
Create the production UI shell for projects, sessions, tabs, controls, config,
and empty/error states.

Acceptance criteria:

- Left sidebar lists projects and session state.
- Main header shows session tabs, agent badge, model selector, and run/stop controls.
- Right panel shows session config and live activity placeholders.
- Empty, starting, running, waiting, errored, exited, and CLI-missing states are represented.
- Layout has no text overlap across desktop and narrow widths.

Suggested labels: `frontend`, `desktop`

Depends on: AIA-004, AIA-008

## AIA-012: Add xterm.js terminal view

Description:
Render live PTY output with full ANSI/TUI behavior.

Acceptance criteria:

- xterm.js renders PTY byte streams.
- Fit addon reports cols/rows to backend on resize.
- Raw input passthrough can send keystrokes to the active session.
- High-volume output is throttled or coalesced to keep the UI responsive.
- Component tests cover mount, resize, cleanup, and output append behavior.

Suggested labels: `frontend`, `terminal`, `pty`

Depends on: AIA-002, AIA-011

## AIA-013: Add structured chat and tool-call view

Description:
Render normalized agent events as a chat transcript with collapsible tool calls
and results.

Acceptance criteria:

- Chat view is available only when adapter capabilities report structured events.
- User, assistant, tool call, tool result, notice, error, and completion events render distinctly.
- Terminal and chat views can switch without restarting a session.
- Malformed structured chunks do not break the transcript.

Suggested labels: `frontend`, `agents`, `chat`

Depends on: AIA-005, AIA-006, AIA-011

## AIA-014: Wire start, prompt, stop, resize, and session events end to end

Description:
Connect the UI controls to backend Tauri commands and streaming events.

Acceptance criteria:

- User can create or select a project and start a session.
- Prompt submission uses adapter input encoding.
- Terminal output and structured events stream to the active UI.
- Stop and force-stop update state correctly.
- Session state is consistent after success, non-zero exit, kill, and crash.

Suggested labels: `frontend`, `backend`, `ipc`

Depends on: AIA-002, AIA-011, AIA-012

## AIA-015: Add automated integration and fixture tests

Description:
Harden the app with tests for PTY lifecycle, adapter parsing, persistence, and
frontend state.

Acceptance criteria:

- Fake CLI integration tests cover start, stream, input, resize, stop, kill, and no orphan process.
- Adapter parser fixtures cover Claude Code, Codex, and Kimi where available.
- Frontend store and component tests cover key states.
- Full validation commands are documented and pass locally.

Suggested labels: `testing`, `backend`, `frontend`

Depends on: AIA-005, AIA-006, AIA-007, AIA-014

## AIA-016: Prepare packaging and release hardening

Description:
Make the v1 app ready for local distribution and later signing.

Acceptance criteria:

- Tauri config contains production app metadata.
- Build works on the primary target OS.
- App shutdown reliably kills all child processes.
- Telemetry remains off by default.
- README documents setup, run, test, and troubleshooting commands.

Suggested labels: `release`, `desktop`, `security`

Depends on: AIA-015

## AIA-017: Spike ACP transport support

Description:
Investigate and add the first minimal Agent Client Protocol transport path
beside the existing PTY fallback. ACP should be treated as the structured
agent-client path for compatible agents, while PTY remains the universal
terminal fallback for CLIs that do not support ACP.

Acceptance criteria:

- Backend records whether each adapter supports `pty`, `acp_stdio`, or both.
- Doctor can show ACP support as available, unavailable, or unknown per adapter.
- A minimal ACP stdio client can launch one compatible agent or fixture process.
- Backend can complete ACP initialization and create a test session.
- Backend can send one prompt and receive streamed session updates from a fake ACP agent fixture.
- Existing PTY fake and Codex smoke paths continue to work unchanged.
- Tests cover ACP initialization success, malformed JSON-RPC, unsupported adapter, process exit, and PTY fallback behavior.

Suggested labels: `backend`, `architecture`, `agents`, `acp`

Depends on: AIA-003, AIA-004

Recommended before: AIA-005, AIA-006, AIA-007, AIA-013, AIA-014

## AIA-018: Add ACP registry discovery

Description:
Expose a local ACP registry candidate list so the app can show which
ACP-compatible adapters are ready, installable, or missing before launching a
real agent. Discovery must not download packages or start agents.

Acceptance criteria:

- Backend exposes curated candidates from the official ACP registry.
- Candidate status distinguishes ready binary, installable npx package,
  missing runner, and missing binary states.
- Frontend shows candidate status, command preview, and install guidance.
- Frontend lets the user select a candidate without launching it.
- Discovery never downloads packages or launches candidate adapters.
- Tests cover npx and binary candidate status mapping.

Suggested labels: `backend`, `frontend`, `agents`, `acp`

Depends on: AIA-017

Recommended before: real ACP adapter launch tasks

## AIA-019: Start selected ACP registry candidate

Description:
Connect the selected ACP registry candidate to the existing ACP stdio runtime
so a user can try a real ACP-compatible adapter from the test panel. Keep fake
ACP available as the deterministic test path.

Acceptance criteria:

- Backend can start a selected registry candidate by id.
- Backend rejects unknown candidates and candidates whose runner/binary is missing.
- Backend reuses the existing ACP initialize and session/new flow.
- Frontend exposes Start Selected ACP for the selected launchable candidate.
- Missing candidates keep Start Selected ACP disabled.
- Agent message chunks are merged into readable messages and technical session updates are hidden from the event list.
- Long ACP start/send operations do not freeze the app window.
- Tests cover command construction, missing runner/binary rejection, event normalization, frontend invoke, and fake ACP regression.

Suggested labels: `backend`, `frontend`, `agents`, `acp`

Depends on: AIA-018

Recommended before: adapter-specific ACP validation
