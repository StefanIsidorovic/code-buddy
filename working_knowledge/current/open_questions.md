# Open Questions

## Blocking
- None.

## Non-Blocking
- Should the package/crate/app identity be renamed from code-buddy to AIadne?
- Should planned frontend dependencies such as Zustand and Tailwind be installed immediately or added when their milestones begin?
- Should AIA-002 fake CLI support Windows immediately, or is Linux-first enough until packaging?
- Should AIA-004 expose adapter detection as a Tauri command only first, or include the first UI doctor panel in the same task?

## Resolved
- Current task: reset to a clean implementation skeleton and produce Linear-ready tasks.
- Repository target: single repository at /home/katarina/projects/AIadne.
- Commit ownership for this task: user will review and commit local changes.
- AIA-002 can proceed without product-level clarification; use test harness output buffering for streaming validation.
- AIA-002 dependency: portable-pty 0.9.0 added and fetched.
- Mind map should exist going forward; active map now lives in working_knowledge/current/mind_map.md and working_knowledge/current/mind_map/.
- AIA-003 can proceed conservatively without validating all real CLI flags; real adapter tasks will check current local help output before hardcoding behavior.
