# Delivery Readiness

## Sources
- Local: src-tauri/src/delivery.rs
- Local: src-tauri/src/commands.rs
- Local: src/lib/tauriGateway.ts
- Local: src/features/delivery/useDeliveryReadiness.ts
- Local: src/features/delivery/DeliveryReadinessPanel.tsx
- Local: src/App.tsx

## Boundary
- Delivery readiness is read-only Git intelligence for the selected repository.
- The feature may inspect branch, HEAD identity, porcelain worktree status, changed-file summaries, and HEAD provenance-note presence.
- The feature may inspect a bounded recent commit/provenance-note history, still as read-only Activity evidence.
- The feature must not expose Ship, Commit, Push, reset, checkout, stash, note-write, or other Git mutation controls.
- Missing HEAD provenance is displayed as a readiness signal, not treated as a command failure.
- Git command execution stays backend-owned; frontend code crosses only through the typed Tauri gateway command.

## Data Flow
- Activity view renders `DeliveryReadinessPanel` for the currently selected repository.
- `useDeliveryReadiness` loads `inspect_git_delivery_readiness` and `list_git_delivery_provenance_history` when the repository path changes and exposes manual refresh.
- The hook keeps a request id guard so late responses from an old repository selection are ignored.
- Backend inspection validates that the path is an existing directory and Git worktree before invoking Git.
- Backend Git calls use `Command::new("git")` with explicit args and no shell.
- Changed files are counted from porcelain status and capped for display while preserving the full count.
- Provenance reads `refs/notes/provenance` on HEAD and extracts `plan_step_id` from JSON notes when available.
- Provenance history reads a capped recent Git log, checks each commit's provenance note, and extracts `plan_step_id`, `severity`, and a bounded `rationale` preview when available.

## UI Shape
- Activity shows readiness as a compact audit card, not as an action launcher.
- Ready state requires a clean worktree and present HEAD provenance note.
- Dirty state shows changed files in a collapsible list.
- Recent provenance shows noted and unnoted commits as an audit trail, not as a delivery action queue.
- Error, empty-repository, and loading states are explicit and accessible.

## Risks
- Do not make readiness imply deployment, mergeability, passing tests, or product correctness until those signals are explicitly added.
- Do not let future Git actions reuse this panel without a separate plan, backend command boundary, tests, and provenance note.
- Keep Task phase/evidence authority separate: delivery readiness is an Activity audit signal, not persisted Task evidence.
