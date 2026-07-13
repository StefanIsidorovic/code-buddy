# Mind Map

## Purpose
- Active topic map for the current AIadne restart state.
- Complements status.md, plan.md, decisions.md, handoff.md, and repo-code-buddy.md.
- Use this map for cross-cutting architecture context that would make the required knowledge files too noisy.

## Files
- mind_map/pty-runtime.md: Rust PTY lifecycle, session state, output buffering, stop/cleanup behavior, and backend command surface.
- mind_map/frontend-terminal.md: React/xterm fallback terminal panel, keyboard input path, output rendering path, primary ACP runtime sidebar, Session History replay/filter/rename controls, ACP launch controls, earth-tone UI palette/font rules, layout constraints, and UI risks.
- mind_map/adapter-boundary.md: AgentAdapter trait, registry, detection, command construction, input encoding, structured parsing hook, and capability metadata.
- mind_map/agent-launch-flow.md: fake CLI, temporary Codex PTY, selected ACP launch flow, cwd/PATH constraints, and deferred agent integration.
- mind_map/acp-transport.md: Agent Client Protocol meaning, fit beside PTY, fake runtime, registry discovery, selected launch, and risks.
- mind_map/workspace-persistence.md: SQLite project/repository storage, ACP transcript persistence/replay/rename, manual Knowledge Cards, Workspace/Session History UI state, selected repository cwd launch wiring, and deferred persistence scope.

## Update Rules
- Update the relevant topic file whenever code changes alter that topic's data flow, ownership, constraints, or risks.
- Add a new topic file only when a stable cross-cutting area appears and does not fit cleanly in an existing file.
- Keep topic files concise, factual, and source-backed.
- If working_knowledge/current/mind_map/ changes, keep this index in sync.
