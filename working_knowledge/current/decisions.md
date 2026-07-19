# Decisions

## Confirmed
- Task boundary: represent the user assignment as a persistent aggregate distinct from ACP runtime and transcript history.
- Session relationship: one ACP transcript session owns at most one Task, created from its first user prompt.
- Phase model: every Task starts with ordered analysis, planning, execution, and review phases; original-prompt intake is Task creation and reusable learning is a review output.
- Knowledge boundary: task knowledge remains separate from project Knowledge Units and manual Knowledge Cards, with explicit producing-phase provenance.
- Prompt integrity: persist the original user prompt separately from any enriched payload sent to ACP.
- Delivery order: establish and test the backend persistence contract before wiring prompt creation or phase orchestration into the large frontend coordinator.

## Deferred
- Phase automation and approval gates: decide after the persistent lifecycle contract is implemented.
- Task knowledge extraction/synthesis format: define with the phase execution contract.
- Multi-session Task continuation: defer until the one-session Task workflow is validated.
- Unified context selection across project, manual, and task knowledge: defer until task artifacts exist.
