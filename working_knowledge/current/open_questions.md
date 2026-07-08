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
- Which registry-backed ACP candidate should be launched first after discovery: codex-acp, claude-acp, kimi, or gemini?

## Resolved
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
