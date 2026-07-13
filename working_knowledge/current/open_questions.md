# Open Questions

## Blocking
- None.

## Non-Blocking
- Should the package/crate/app identity be renamed from code-buddy to AIadne?
- Should planned frontend dependencies such as Zustand and Tailwind be installed immediately or added when their milestones begin?
- Should AIA-002 fake CLI support Windows immediately, or is Linux-first enough until packaging?
- Which full real-agent adapter should be implemented first: Claude Code, Codex, or Kimi?
- Which real agent or fixture should be used first for ACP stdio validation after the fake ACP fixture proves the transport?
- Should fake ACP support Windows before packaging, or is Linux-first enough while the ACP spike stays local?
- What project metadata belongs in the first real workspace model beyond name and path: default agent, model, instructions, or last session?
- Should the next transcript step be continue-from-transcript context, rich chat/tool-call UI, session grouping/tags, or PTY scrollback persistence?

## Resolved
- AIA-040 scope: Facts collection now gathers deterministic local git/repository facts for selected initialization repositories only; agent summarization remains deferred.
- AIA-047 scope: transient Workspace success/error messages now use bottom-right auto-dismiss toasts; modal-local errors stay inline.
- AIA-046 scope: confirmed Project delete stops all running ACP sessions before deleting the project record.
- AIA-045 scope: Add Project now supports native system folder selection while keeping manual path entry.
- AIA-045 active cwd: running sessions keep their launch cwd after project deletion, and the UI now displays that active folder explicitly.
- AIA-044 scope: Project delete uses the existing backend command but now requires a frontend confirmation dialog.
- AIA-039 scope: Project Initialize is project-level; the user chooses participating repositories in a popup before the run is created.
- AIA-039 phase split: preflight/repository selection is first; facts, markdown analysis, interview guardrails, and summary review are separate follow-up tasks.
- AIA-038 scope: move manual Knowledge Card creation into a popup while preserving existing card list, attach behavior, and prompt injection.
- AIA-037 scope: fix visible output layout and ACP waiting-state release only; backend ACP protocol and storage behavior stay unchanged.
- AIA-036 scope: full-width shell and sidebar metadata placement only; runtime behavior and storage stay unchanged.
- AIA-035 scope: a project can contain multiple local repository folders; selected repository controls agent launch cwd while transcripts and Knowledge Cards remain project-scoped in this slice.
- Continue target on 2026-07-13: validate/review current local AIA-034 Terminal PTY fallback UI before taking a new feature.
- Current task: reset to a clean implementation skeleton and produce Linear-ready tasks.
- Repository target: single repository at /home/katarina/projects/AIadne.
- Commit ownership for this task: user will review and commit local changes.
- AIA-002 can proceed without product-level clarification; use test harness output buffering for streaming validation.
- AIA-002 dependency: portable-pty 0.9.0 added and fetched.
- Mind map should exist going forward; active map now lives in working_knowledge/current/mind_map.md and working_knowledge/current/mind_map/.
- AIA-003 can proceed conservatively without validating all real CLI flags; real adapter tasks will check current local help output before hardcoding behavior.
- AIA-004 includes both backend detection and the first temporary Agent Doctor UI panel.
- ACP should be tracked as a structured transport spike rather than replacing PTY immediately.
- AIA-017 first slice uses a fake ACP stdio fixture and keeps real adapter ACP support Unknown until validated.
- AIA-018 discovery should not install, download, or launch ACP adapters; it only reports local readiness and command previews.
- AIA-019 adds the explicit Start Selected ACP launch action; discovery and selection still do not launch processes.
- Codex ACP is the first manually validated registry-backed ACP candidate, but launch should stay generic through Start Selected ACP rather than a Codex-specific button.
- AIA-022 first workspace slice stores only project name/path and uses the selected project path as PTY/ACP launch cwd.
- AIA-024 first transcript slice stores ACP transcript sessions and ordered events, while full replay UI and PTY scrollback stay deferred.
- AIA-025 adds minimal saved transcript replay from Session History; rich chat/tool-call replay stays deferred.
- AIA-026 moves runtime mode, collapsible agent selection, Session History, and compact status into the left sidebar; final workspace/session UI stays deferred.
- AIA-027 normalizes saved ACP transcript replay into question/answer rows; full chat/tool-call UI remains deferred.
- AIA-028 adds ACP output autoscroll and fixes stale transcript ids in background ACP drain polling; old transcripts with never-persisted chunks cannot be reconstructed.
- AIA-029 applies CSS-only pastel UI polish to the temporary runtime workspace; final product UI still remains deferred.
- AIA-030 applies the user-provided earth-tone palette and CSS-only font polish across the whole temporary app UI; final product UI still remains deferred.
- AIA-031 starts with manual Knowledge Cards and explicit attach controls; automatic promotion, relevance suggestions, conflict handling, and knowledge review UI remain deferred.
- AIA-033 adds minimal Session History filtering and selected-session rename; richer session grouping, tags, archive/delete, and final library UI remain deferred.
