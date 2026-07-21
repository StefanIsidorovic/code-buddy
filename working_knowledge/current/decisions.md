# Decisions

## Confirmed
- Task boundary: represent the user assignment as a persistent aggregate distinct from ACP runtime and transcript history.
- Session relationship: one ACP transcript session owns at most one Task, created from its first user prompt.
- Phase model: every Task starts with ordered analysis, planning, execution, and review phases; original-prompt intake is Task creation and reusable learning is a review output.
- Knowledge boundary: task knowledge remains separate from project Knowledge Units and manual Knowledge Cards, with explicit producing-phase provenance.
- Prompt integrity: persist the original user prompt separately from any enriched payload sent to ACP.
- Delivery order: establish and test the backend persistence contract before wiring prompt creation or phase orchestration into the large frontend coordinator.
- Complexity ownership: the Rust backend produces a deterministic initial quick/standard/complex assessment; the initial result remains immutable while an effective profile may be changed with explicit provenance.
- Complexity control: ambiguous prompts default to standard, analysis may later propose reclassification, and the user retains final override control.
- Model boundary: Summary uses the synthesis catalog, while coding models are discovered from and changed through the active ACP agent; a coding choice is session-scoped and never mutates global Codex configuration.
- Phase artifact boundary: persist immutable per-phase content separately from transcript history, with normalized links to one or more real transcript events from the Task's own session.
- Phase gate policy: every canonical phase requires explicit `start` and evidence-backed `complete`; completion advances to the next pending phase but never starts it automatically.

## Deferred
- Task knowledge extraction/synthesis format: artifact `kind` remains extensible until phase execution defines curated kinds; content and provenance are already immutable.
- Multi-session Task continuation: defer until the one-session Task workflow is validated.
- Unified context selection across project, manual, and task knowledge: defer until task artifacts exist.
