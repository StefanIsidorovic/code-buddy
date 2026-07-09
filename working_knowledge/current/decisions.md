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
- Mind map usage: maintain an active mind map for cross-cutting PTY runtime, frontend terminal, and agent launch flow knowledge.
- AIA-003 adapter boundary: add AgentAdapter and AgentRegistry before full real-agent adapters; keep unvalidated Claude/Codex/Kimi capabilities as Unknown where appropriate.
- Codex smoke integration: route the temporary Codex command construction through CodexAdapter, but defer full Codex adapter behavior to AIA-006.
- AIA-004 doctor: use backend-owned detection/version reports and keep frontend as a display/blocking layer.
- AIA-004 version checks: use `<binary> --version` with a timeout and convert failures into error states rather than panics.
- Local progress: maintain LOCAL_PROGRESS.md as a git-ignored human-readable project diary.
- ACP direction: add Agent Client Protocol as a structured transport spike beside PTY; keep PTY as the universal fallback for terminal-only agents.
- AIA-017 ACP implementation: keep ACP in a separate AcpSessionManager instead of mixing JSON-RPC sessions into the PTY SessionManager.
- AIA-017 fixture scope: use a fake ACP stdio subprocess first; built-in real adapters keep ACP support Unknown until validated.
- Knowledge hygiene: whenever a new concept, technology, runtime path, workflow, or architectural rule is introduced, update all relevant docs, Linear task drafts, working_knowledge files, mind map files, and LOCAL_PROGRESS.md in the same work step.
- Approach selection: when a task can be solved in multiple ways, compare the stable/default path with newer relevant approaches and propose the newer option when it offers real product or architecture value without unnecessary risk.
- AIA-018 ACP registry discovery: use a curated candidate list from the official ACP registry before real launches; report ready/installable/missing states without downloading packages or starting agents.
- AIA-019 ACP launch boundary: starting a registry-backed ACP candidate must happen only through an explicit user action; discovery and selection remain side-effect-free.
- AIA-020 generic ACP launch: keep `Start Selected ACP` as the single registry-backed ACP launch action instead of adding per-agent direct buttons; this keeps the same flow usable for Codex, Claude, Kimi, Gemini, and future candidates.
- AIA-021 Codex ACP runtime: harden the validated Codex ACP path before UI polish by using longer prompt waits, short control waits, child-exit-aware response waiting, and duplicate prompt rejection.
- AIA-022 workspace persistence: use a small Rust-owned SQLite ProjectStore for saved project folders before building final session UI or transcript history.
- AIA-022 launch cwd: PTY and ACP sessions should run in the selected project directory when a workspace is selected, and should still work without a selected workspace.

## Deferred
- App/package rename from code-buddy to AIadne: defer until explicitly requested.
- Installing Zustand, Tailwind, or SQL plugin dependencies: defer until their milestone begins unless the user asks for a dependency-only setup commit.
- Adapter-specific ACP validation: defer claims that Codex/Claude/Kimi/Gemini are fully supported until each candidate passes manual initialize/session/prompt testing.
- Session transcript/history persistence: defer until the workspace model and runtime launch flow are stable.
