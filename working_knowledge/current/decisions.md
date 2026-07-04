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

## Deferred
- App/package rename from code-buddy to AIadne: defer until explicitly requested.
- Installing xterm.js, Zustand, Tailwind, portable-pty, or SQL plugin dependencies: defer until their milestone begins unless the user asks for a dependency-only setup commit.
- Retrospective provenance repair for 74ca850: report and defer unless requested.
