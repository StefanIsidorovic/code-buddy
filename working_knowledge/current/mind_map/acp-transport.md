# ACP Transport

## Sources
- External: https://agentclientprotocol.com/get-started/introduction
- External: https://agentclientprotocol.com/get-started/architecture
- External: https://agentclientprotocol.com/protocol/v1/overview
- External: https://agentclientprotocol.com/protocol/v1/transports
- Local: src-tauri/src/acp.rs
- Local: src-tauri/src/commands.rs
- Local: src/App.tsx
- Local: src/App.test.tsx
- Local: docs/linear-tasks.md

## Plain Meaning
- ACP means Agent Client Protocol.
- In AIadne terms, AIadne is the client and a coding agent is the server-like subprocess.
- PTY sends terminal bytes; ACP sends structured JSON-RPC messages.
- ACP is useful when an agent supports editor-style events such as messages, tool calls, diffs, permissions, and progress updates.
- PTY remains required as the fallback for terminal-first CLIs and TUI agents.

## Current Fit In AIadne
- ACP is now a second backend runtime beside the PTY runtime.
- src-tauri/src/acp.rs owns fake ACP subprocess lifecycle, JSON-RPC line framing, initialization, session creation, prompt sending, cancellation, event buffering, and cleanup.
- Adapter descriptors now report transport support with pty and acp_stdio statuses.
- The temporary frontend has an ACP Test panel and renders ACP events as structured UI list items, not through xterm.
- PTY remains the fallback path for terminal-first CLIs.

## First Slice
- AIA-017 first slice is implemented locally with a fake ACP stdio fixture.
- Proven: initialize, session/new, session/prompt, session/update drain, malformed JSON handling, empty prompt rejection, missing session error, process cleanup, and PTY regression coverage.
- Built-in Codex, Claude Code, and Kimi ACP support remains Unknown until real adapter validation.

## Watchouts
- ACP stdout must contain only valid ACP JSON-RPC messages; logs belong on stderr.
- ACP does not remove the need for xterm because some agents still work only through terminal UI.
- Remote ACP support is still not the first local target; start with stdio.
- ACP should not be mixed into the existing PTY SessionManager until the boundary is clear.
- The fake ACP fixture is shell-based for local Linux validation; replace with real ACP agent process validation before claiming support for a real CLI.
- Client-side ACP requests from agents, such as permission requests, are not implemented yet; the first slice handles responses and session/update notifications only.
