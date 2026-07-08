# Frontend Terminal

## Sources
- src/App.tsx
- src/App.css
- src/App.test.tsx
- package.json

## Current Shape
- App.tsx is a temporary PTY smoke-test panel, not the final product UI.
- xterm.js renders PTY output and captures terminal keyboard input.
- FitAddon fits xterm to the available terminal frame.
- The panel exposes Start Fake, Start Codex, Drain, Resize, Stop, and Kill controls.
- The old HTML line input was removed because Codex TUI needs direct terminal keyboard data.

## Data Flow
- Start Fake invokes start_fake_session with current fitted xterm cols/rows.
- Start Codex invokes start_codex_session with current fitted xterm cols/rows.
- xterm onData forwards keyboard data to write_session_input for the active running session.
- Output is drained on an interval and written into xterm with terminal.write.
- ResizeObserver fits xterm and sends resize_session if cols/rows changed.
- Output state is retained only as an accessibility fallback for tests/screen readers.

## Layout Rules
- html, body, #root, and app-shell are viewport-bound.
- Page-level scrolling is disabled for the PTY test page.
- Long terminal output should scroll inside the xterm viewport.
- Terminal frame is click-focusable so typing goes to xterm.

## Tests
- Frontend tests mock Tauri invoke, xterm Terminal, FitAddon, and ResizeObserver.
- Tests cover rendering Start Fake/Start Codex controls and forwarding xterm keyboard data to write_session_input.

## Watchouts
- Output polling interval is currently 400 ms and may feel slow.
- Every keypress can become a separate Tauri invoke; batching may be needed.
- Vite build warns about xterm chunk size over 500 kB; build still succeeds.
- ResizeObserver can call fit/resize often; throttle/debounce may be needed later.
- This is a test panel; final session UI should be redesigned after adapter and persistence tasks.
