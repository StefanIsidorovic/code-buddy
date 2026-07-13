# PTY Runtime

## Sources
- src-tauri/src/session.rs
- src-tauri/src/commands.rs
- src-tauri/src/lib.rs
- src-tauri/Cargo.toml

## Current Shape
- SessionManager is managed as Tauri app state in src-tauri/src/lib.rs.
- SessionManager owns a map of session id to PtySession.
- PtySession owns the resolved cwd, PTY master, writer, child process handle, bounded output buffer, and runtime state.
- portable-pty provides native_pty_system, openpty, command spawn, reader/writer handles, resize, try_wait, and kill behavior.

## Data Flow
- start_fake_session and start_codex_session enter through Tauri commands.
- SessionManager resolves cwd and size, then spawns a PtySession.
- PtySession opens a PTY, spawns the configured command on the slave side, clones a reader, takes a writer, and starts a reader thread.
- Reader thread appends bytes into a bounded VecDeque output buffer.
- Frontend drains output through drain_session_output and writes chunks into xterm.
- Frontend sends keyboard data through write_session_input; backend writes bytes directly to the PTY writer.
- Frontend sends resize_session with cols/rows; backend resizes the PTY master.
- stop_session sends interrupt first, waits briefly, then force-kills if needed.
- SessionManager and PtySession drop paths attempt to kill remaining child processes.
- SessionInfo includes the resolved cwd so the frontend can show the active process folder separately from selected Workspace state.

## Constraints
- Output delivery is currently pull-based polling from frontend, not backend event streaming.
- Output buffer is bounded to 1 MiB.
- Stop timeout is 750 ms and wait polling interval is 25 ms.
- Fake CLI is Linux-first via /bin/sh; Windows command is still a placeholder.
- Session cwd defaults to the backend process current directory unless the frontend passes one.
- Deleting a saved Workspace project does not alter an already-running PTY process cwd.

## Tests
- Backend tests cover fake start/output, input echo, resize, graceful stop, force stop, missing session, manager drop cleanup, and 8 concurrent fake sessions.
- app_status test confirms the backend is in pty-core mode.

## Watchouts
- Event streaming will likely replace frontend polling in a later optimization task.
- Per-key Tauri invoke calls may need batching when input latency becomes a priority.
- Cross-platform PTY and fake CLI behavior still need Windows/macOS validation beyond local Linux tests.
