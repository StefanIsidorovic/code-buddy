# Decisions

## Confirmed
- Reset direction: remove implemented feature code and keep only a buildable technology skeleton.
- Stack baseline: keep Tauri v2, Rust, React, TypeScript, and Vite as the active scaffold.
- Documentation deliverable: create Linear-ready tasks in the repository so they can be copied into Linear.
- Scope control: do not implement PTY, adapters, persistence, keychain, AGENTS.md embedding, or session UI in this reset pass.
- Commit ownership: user will review and commit the local changes.
- AIA-002 implementation: use portable-pty and a fake echo CLI before real agent adapters.
- AIA-002 streaming validation: expose a bounded backend output buffer that tests and later IPC can drain.
- AIA-002 platform scope: validate fake CLI on Linux now; harden Windows behavior in a later cross-platform pass.
- Codex smoke test: add a temporary start_codex_session path using codex --no-alt-screen --cd <cwd>, while keeping the full adapter abstraction deferred.
- PTY rendering: introduce xterm.js early for the smoke-test panel because real Codex output is ANSI/TUI and is not readable in a raw pre block.
- PTY panel scrolling: keep the desktop test page fixed to the viewport and let long output scroll only inside xterm.
- PTY input: route keyboard data through xterm onData directly into the backend PTY; a separate HTML input form cannot support Codex TUI interactions reliably.

## Deferred
- App/package rename from code-buddy to AIadne: defer until explicitly requested.
- Installing Zustand, Tailwind, or SQL plugin dependencies: defer until their milestone begins unless the user asks for a dependency-only setup commit.
- Retrospective provenance repair for 74ca850: report and defer unless requested.
