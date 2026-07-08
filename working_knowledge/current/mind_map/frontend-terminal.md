# Frontend Terminal

## Sources
- src/App.tsx
- src/App.css
- src/App.test.tsx
- package.json

## Current Shape
- App.tsx is a temporary runtime smoke-test panel, not the final product UI.
- xterm.js renders PTY output and captures terminal keyboard input.
- FitAddon fits xterm to the available terminal frame.
- The panel exposes Start Fake, Start Codex, Drain, Resize, Stop, and Kill controls.
- The panel exposes an Agent Doctor list for Codex, Claude Code, and Kimi CLI readiness.
- The panel exposes an ACP Registry list for ACP-compatible adapter candidates.
- The panel exposes a temporary ACP Test area for fake ACP stdio validation.
- ACP events render as structured list items below the xterm terminal.
- The old HTML line input was removed because Codex TUI needs direct terminal keyboard data.

## Data Flow
- Start Fake invokes start_fake_session with current fitted xterm cols/rows.
- Agent Doctor invokes list_agent_doctor_reports on mount and Refresh.
- Agent Doctor displays adapter transport metadata for PTY and ACP stdio support.
- ACP Registry invokes list_acp_registry_candidates on mount and Refresh.
- ACP Registry displays status, command preview, and install guidance without launching anything.
- ACP Registry lets the user select a candidate; selection is frontend state only until a real ACP launch command exists.
- Start Codex is disabled unless the Codex doctor report status is installed.
- Start Codex invokes start_codex_session with current fitted xterm cols/rows.
- xterm onData forwards keyboard data to write_session_input for the active running session.
- Output is drained on an interval and written into xterm with terminal.write.
- ResizeObserver fits xterm and sends resize_session if cols/rows changed.
- Output state is retained only as an accessibility fallback for tests/screen readers.
- Start Fake ACP invokes start_fake_acp_session.
- Send ACP invokes send_acp_prompt and then drain_acp_events.
- ACP events are stored separately from PTY output and are not written to xterm.

## Layout Rules
- html, body, #root, and app-shell are viewport-bound.
- Page-level scrolling is disabled for the PTY test page.
- Long terminal output should scroll inside the xterm viewport.
- Terminal frame is click-focusable so typing goes to xterm.
- Control panel has bounded internal scrolling so the page remains viewport-bound after adding ACP controls.

## Tests
- Frontend tests mock Tauri invoke, xterm Terminal, FitAddon, and ResizeObserver.
- Tests cover rendering Start Fake/Start Codex/Start Fake ACP controls, doctor installed/missing/error display, transport metadata display, missing Codex blocking, forwarding xterm keyboard data to write_session_input, and rendering fake ACP events.
- Tests also cover ACP Registry rendering, command preview, missing binary status, and candidate selection without launching.

## Watchouts
- Output polling interval is currently 400 ms and may feel slow.
- Every keypress can become a separate Tauri invoke; batching may be needed.
- Vite build warns about xterm chunk size over 500 kB; build still succeeds.
- ResizeObserver can call fit/resize often; throttle/debounce may be needed later.
- Doctor version checks are backend-owned; frontend should not shell out or infer PATH state.
- ACP JSON-RPC events should be normalized by the backend; frontend should not parse raw ACP protocol messages.
- ACP Registry is discovery only; frontend should not call npx, download packages, or infer readiness beyond backend candidate status.
- This is a test panel; final session UI should be redesigned after adapter and persistence tasks.
