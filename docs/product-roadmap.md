# AIadne Product Roadmap

## Product Direction

AIadne should become an evidence-aware agent workspace that combines its source-backed project knowledge and explicit context controls with the strongest orchestration, review, and Git provenance ideas already proven in Conductor.

The differentiator is not a larger feature count. It is a trustworthy loop in which every task has explainable context, gated phases, auditable agent actions, review evidence, and reusable learning.

## Architecture Principles

- Keep Tauri/Rust authoritative for persistence, process lifecycle, protocol normalization, secrets, Git mutation, and audit records.
- Organize the frontend by product feature, with `App.tsx` as a composition root rather than a workflow implementation file.
- Use typed command gateways instead of scattering raw `invoke` calls through components.
- Use Zustand only for cross-feature client state; keep form drafts, modal state, and request-local state close to their owning feature.
- Preserve original prompts and immutable evidence separately from rendered or enriched agent context.
- Prefer explicit phase gates and user-visible policy over hidden automation.

## Delivery Sequence

### 19. Frontend Modular Foundation

- 19.1: extract shared presentation utilities from `App.tsx` with direct unit coverage and establish the product roadmap.
- 19.2: extract reusable UI primitives and global notifications through the first narrowly owned Zustand store.
- 19.3: extract backend DTO contracts into one dependency-free source of truth.
- 19.4: iteratively split workspace, initialization, knowledge, session-history, ACP runtime, output, and PTY fallback into feature components with typed view-model boundaries.
- 19.5: introduce small Zustand stores for active workspace/task/session; keep local UI drafts local.
- 19.6: move feature orchestration into hooks/services and route all backend calls through a typed Tauri gateway.
- 19.7: add route-level/lazy feature boundaries and enforce size/import constraints to prevent another monolith.

### 20. Evidence-Aware Task Workflow

- Implemented foundation: immutable per-phase Task artifacts with same-transcript event provenance and typed create/list commands.
- Persist immutable phase outputs with transcript-event provenance.
- Enforce analysis, planning, execution, and review transitions with explicit retry and approval rules.
- Build task context from project Knowledge Units, manual cards, and task artifacts with a visible inclusion preview.
- Add complexity-aware phase depth without hiding or rewriting the user's requested scope.

### 21. Multi-Agent Runtime

- Normalize ACP events and capabilities across Codex, Claude, Kimi, Gemini, and future adapters.
- Add resumable channels, permission requests, cancellation, and per-session model controls.
- Support deliberate advisor/reviewer roles without letting multiple agents mutate the same step concurrently.

### 22. Execution And Review Harness

- Execute one approved plan item at a time with bounded validation budgets.
- Capture commands, diffs, test evidence, failures, retries, and review findings as task artifacts.
- Add adversarial review and repair loops with explicit stop conditions.
- Require one commit and machine-readable provenance note for every accepted execution step.

### 23. Git And Delivery Intelligence

- Add repository, diff, history, blame, provenance, branch, and pull-request views.
- Link commits and review findings back to Task phases and evidence.
- Add safe Ship gates for clean worktree, tests, review, provenance, and remote readiness.

### 24. Learning And Automation

- Publish reviewed task learning into project knowledge through an approval flow.
- Measure context usefulness, plan quality, review catches, retries, and task outcomes.
- Add explainable automation policies by complexity and risk, with user overrides and audit history.
- Calibrate classifiers from measured outcomes without rewriting historical assessments.

## Conductor Reuse Boundary

Reuse concepts and, where compatible, focused implementations for adapter metadata, normalized agent events, Git/provenance reading, validation budgets, plan critique/repair, and review dossiers. Do not copy Conductor's broad command module or frontend state shape wholesale; AIadne's task, evidence, and context contracts remain authoritative.

## Success Criteria

- `App.tsx` is a small composition root and no feature coordinator becomes a replacement monolith.
- A user can trace every included context item, phase output, code change, validation result, review decision, and commit to its source.
- Multi-agent work remains deterministic at mutation boundaries.
- The application can recover active projects, tasks, sessions, and phase state after restart.
- New capabilities add feature modules and contracts rather than expanding a global coordinator.
