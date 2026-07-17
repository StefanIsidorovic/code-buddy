# Agent Launch Flow

## Sources
- src-tauri/src/session.rs
- src-tauri/src/acp.rs
- src-tauri/src/adapters.rs
- src-tauri/src/commands.rs
- src/App.tsx
- README.md
- docs/linear-tasks.md

## Current Shape
- Fake CLI is the reliable test target for AIA-002.
- Codex CLI launch is still a temporary smoke-test path, but command construction now goes through CodexAdapter.
- Fake ACP launch is now a separate stdio/JSON-RPC smoke-test path.
- ACP registry discovery is a side-effect-free candidate list before real ACP launches.
- The frontend chooses fake or Codex by invoking start_fake_session or start_codex_session.
- The frontend starts fake ACP by invoking start_fake_acp_session and sends prompts through send_acp_prompt.
- The frontend lists ACP candidates by invoking list_acp_registry_candidates.
- The frontend starts selected ACP candidates by invoking start_acp_registry_session.
- The frontend can select a saved Workspace project and include that path as launch cwd.
- The frontend can choose a Workspace project path through the native Tauri folder picker.
- Frontend blocks Start Codex when Agent Doctor reports Codex missing or errored.
- Backend command registration exposes PTY and ACP launch paths through Tauri.

## Fake CLI Flow
- start_fake_session resolves cwd and PTY size.
- Unix fake command starts /bin/sh and prints fake-ready.
- Fake command echoes each input line as fake:<line>.
- Fake session is used by backend tests and manual UI testing.

## Codex Flow
- start_codex_session resolves cwd and PTY size.
- codex_command uses CodexAdapter detection and command construction.
- Codex doctor status is fetched through list_agent_doctor_reports before the user starts Codex.
- Codex is launched with --no-alt-screen and --cd <cwd>.
- command.cwd(cwd) is also set on the spawned process.
- xterm is required because Codex emits ANSI/TUI output and expects terminal keyboard input.

## Fake ACP Flow
- start_fake_acp_session starts a shell-based fake ACP subprocess with stdin/stdout pipes.
- Backend sends ACP initialize, then session/new.
- Send ACP sends session/prompt with a text content block.
- Fake ACP emits session/update as JSON-RPC; backend normalizes it into AcpSessionEvent.
- Frontend displays ACP events in a structured list instead of writing them to xterm.
- stop_acp_session sends session/cancel, waits briefly, then force-kills if needed.

## ACP Registry Flow
- list_acp_registry_candidates returns curated candidates based on the official ACP registry.
- npx candidates include codex-acp, claude-acp, and gemini; they are installable when npx exists.
- Binary candidates include kimi; they are ready only when the executable is available on PATH.
- Discovery shows command previews and install hints but does not start a process or download packages.

## Selected ACP Launch Flow
- User selects a launchable ACP Registry candidate.
- Start Selected ACP invokes start_acp_registry_session with candidateId and selected project cwd when present.
- Backend resolves the candidate id, rejects missing runner/binary states, and builds the process command.
- The selected process is launched over stdio and then uses the same initialize/session/new flow as fake ACP.
- npx candidates may download their package on first explicit launch.
- Candidate selection is disabled while an ACP session is running.
- Confirmed Project deletion stops all running ACP sessions before deleting the project record.

## Boundaries
- AgentAdapter abstraction exists for detection, capabilities, command construction, input encoding, structured parsing hook, and AGENTS.md delivery strategy.
- Adapter descriptors expose transport support for pty and acp_stdio.
- AgentRegistry can list and resolve compiled-in Codex, Claude Code, and Kimi adapters.
- Project workspace persistence is connected to PTY and ACP launches as cwd only.
- No keychain or API-key management is connected to launches.
- PTY and ACP session info include the resolved cwd so the UI can distinguish selected Workspace from the active running process folder.
- ACP sessions are explicitly stopped on Project delete; PTY sessions are not yet part of that delete safety flow.
- Native folder picker exists for Add Project; repository path entry is still manual.
- If no Workspace is selected, cwd defaults to the backend process current directory.
- Start Codex depends on codex being available on PATH in the environment that launches npm run tauri dev.
- Missing Codex now shows an install guidance placeholder instead of allowing a doomed start attempt.

## Deferred Work
- Replace temporary start_codex_session with the full adapter-driven session start path from later Linear tasks.
- Replace fake ACP with real ACP-compatible adapter launches after each CLI is validated.
- Manually validate the first registry-backed ACP candidate through initialize, session/new, session/prompt, auth, and permission flows.
- Add richer per-project defaults before final UI.
- Add event-streamed PTY output instead of drain polling.
- Move doctor UI from the temporary PTY panel into the final first-run/workspace UI.
