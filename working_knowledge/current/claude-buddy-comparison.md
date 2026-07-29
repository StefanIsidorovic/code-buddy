# AIadne / Claude Buddy Task Orchestration Comparison

## Scope

This is a source-backed comparison of the local repositories inspected on
2026-07-29. It compares implemented behavior and tests, not roadmap claims.

- AIadne: `/home/katarina/projects/AIadne` at `1d2a39f`
- Claude Buddy: `/home/katarina/projects/claude_buddy` at `6420e91`

## Capability Matrix

| Capability | AIadne | Claude Buddy | Finding |
| --- | --- | --- | --- |
| Structured requirements and ordered steps | Versioned plan requirements, dependencies, scopes and acceptance criteria in `src-tauri/src/task_plan.rs` and `src/features/tasks/TaskPlanEditor.tsx` | Plans, implementation plans and step entities under `src-tauri/src/layer2/` | Both implemented |
| Parallel step execution | Dependency/scope-safe waves with up to three isolated workers in `task_plan.rs`, `taskExecutionWaves.ts` and `useTaskStepExecution.ts` | `runner.rs` rejects a step until every earlier step is committed and reports that the sequence is strictly linear | AIadne stronger |
| Repository isolation | AIadne-owned clean-HEAD worktrees with durable ownership and integration receipts in `task_worktree.rs` and storage | Per-task/per-step Git branches and one squashed commit per step in `layer2/runner.rs` | Different, both implemented |
| Automated evaluation | Snapshot-isolated, receipt-grounded wave evaluator; model claims cannot replace persisted Git verification | Harness plus optional adversarial reviewer in `layer2/harness.rs` and `layer2/reviewer.rs` | Both implemented |
| Safe automatic continuation | Explicit Task-local guarded autopilot accepts only grounded safe passes, integrates serially and continues dependency waves | Overseer and gate policy drive a broader full-auto conductor | Buddy broader; AIadne authority narrower |
| Failure recovery | Partial worker success is preserved; evaluator can retry; integration conflict refreshes durable state and retains isolation | Decisions inbox, harness failure gates, review/fix cycles and dirty-repository stops | Both implemented with different recovery models |
| Human gates | Task-local autopilot is opt-in; phase completion remains explicit | Configurable Auto/Batch/Prompt routes, while merge and selected hard gates remain prompted | Buddy more configurable |
| Knowledge/provenance | Same-project Project Knowledge readiness gates, transcript provenance, immutable phase artifacts and Git notes | Atlas/context projections, stale-context gates and conductor metadata | Both implemented; AIadne evidence chain is more explicit in Task UX |
| Automated test evidence | 343 frontend tests and 143 Rust tests pass for the inspected revision | Broad Rust unit/integration coverage exists; `package.json` exposes no frontend test command | AIadne stronger visible end-to-end UI coverage |
| Multi-repository task conduction | Project can register multiple repositories, but structured step execution is bound to the selected repository | Runner explicitly handles task branches per repository | Buddy stronger |

## Honest Conclusion

AIadne now exceeds the inspected Claude Buddy revision for dependency-aware
parallel isolated execution, grounded per-wave evidence and visible frontend
test coverage. It does not yet exceed Buddy in every dimension: Buddy has a
broader configurable conductor, decisions inbox and deeper multi-repository
task execution. Therefore the defensible status is capability parity for the
core single-repository Task loop, not universal product superiority.

## Recovery Scenarios Verified In AIadne

- Independent eligible steps start concurrently and partial startup failure
  preserves successful receipts.
- Evaluator failure preserves worker results and supports retry.
- Late evaluator output from a previously selected Task is ignored.
- Guarded autopilot stops before the next run on review failure.
- Guarded autopilot continues through the next dependency wave after safe
  serial integration.
- Integration failure stops continuation, refreshes the durable conflicted
  receipt and retains the isolated worktree recovery location.

## Next Differentiators

1. Persist an execution-level conductor run so auto-continuation survives an
   application restart instead of relying on the mounted Task view.
2. Add a decisions inbox for blocked runs and conflict-resolution ownership.
3. Extend one approved Task plan across multiple registered repositories with
   repository-specific scopes, waves and integration policy.
