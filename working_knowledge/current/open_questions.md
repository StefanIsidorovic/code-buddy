# Open Questions

## Blocking
- None.

## Non-Blocking
- Should the package/crate/app identity be renamed from code-buddy to AIadne?
- Should planned frontend dependencies such as xterm.js, Zustand, and Tailwind be installed immediately or added when their milestones begin?
- Should the missing provenance note for pre-existing commit 74ca850 be repaired with a retrospective note?
- Should AIA-002 fake CLI support Windows immediately, or is Linux-first enough until packaging?

## Resolved
- Current task: reset to a clean implementation skeleton and produce Linear-ready tasks.
- Repository target: single repository at /home/katarina/projects/AIadne.
- Pre-existing dirty file: package-lock.json; avoid touching it unless necessary.
- Commit ownership for this task: user will review and commit local changes.
- AIA-002 can proceed without product-level clarification; use test harness output buffering for streaming validation.
- AIA-002 dependency: portable-pty 0.9.0 added and fetched.
