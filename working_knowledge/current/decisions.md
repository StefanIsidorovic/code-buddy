# Decisions

## Confirmed
- Use the repository AGENTS.md as the active workflow contract: it is the only permanent instruction file present.
- Treat archived knowledge as unavailable: no working_knowledge archive exists yet.
- Implement a staged full v1 slice, not only the skeleton milestone.
- Treat Linux as the first acceptance target.
- Track working_knowledge files in the repository after updating ignore rules.
- Stay on the Tauri/Rust architecture and pause until dependencies are installed.
- Keep SessionManager as the single process lifecycle owner; it is not cloneable and kills active child sessions on drop.
- For force stop, emit killed and remove the session before reader-thread exit handling so the UI does not receive a later exited state for a killed session.
- Use Zustand for frontend runtime state and keep Tauri command/event calls behind src/lib/api.ts.
- Load xterm.js dynamically in the terminal component so tests and non-browser contexts do not depend on canvas/WebGL.
- Use one AgentOutputParser per running session instead of parsing through shared adapter instances, so structured JSONL buffering cannot leak across sessions.

## Deferred
- Session resume inclusion: not yet decided.
- Approval UX centralization: not yet decided.
