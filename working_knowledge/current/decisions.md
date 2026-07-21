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
- Unified context boundary: preview project knowledge, explicitly attached cards, and current-Task artifacts through one deterministic budgeted result; source type and inclusion reason remain visible, and preview never implies ACP injection.
- Explicit context send boundary: only the preview confirmation action may enrich the ACP wire prompt; Task `originalPrompt` and transcript user messages keep the plain user prompt, and legacy Send ACP remains compatible.
- Dispatch audit boundary: persist a `pending` receipt before the external ACP side effect, then finalize `sent`/`failed`; an interrupted or SQLite-finalization-uncertain dispatch remains conservatively `pending` rather than claiming success.
- Pending dispatch recovery: manual recovery may only turn `pending` into `failed` with an explicit bounded reason, and only while the associated ACP session is not running; it can never manufacture a `sent` outcome.
- Controlled phase execution: a Run action sends one visible canonical phase instruction only for the exact active Task; ACP output does not create evidence, complete the phase, or advance the state machine automatically.
- Phase-run audit boundary: persist an ordered `pending` receipt only for the current in-progress phase before ACP dispatch, then finalize once as `sent`/`failed`; interrupted uncertainty remains `pending`.
- Phase-run recovery: manual recovery may only mark pending as failed with a bounded reason after the associated ACP session stops; finalized outcomes cannot be rewritten.
- Evidence draft boundary: the explicit draft action copies only the highest-sequence persisted agent message/thought and selects its real event ID; persistence and phase completion remain separate user actions.
- Review checkpoint boundary: persisted artifacts remain the backend completion gate; the phase-aware acknowledgment is a transient UI safeguard reset by Task, evidence, or transition changes and must not be represented as a durable audit approval.
- Runtime layout boundary: the runtime lane is a dynamic vertical flex stack because ACP and PTY have different optional child counts; Task Phase remains primary while audit histories live under a native collapsed Task activity disclosure.
- Provenance picker boundary: generic text-input sizing must explicitly exclude checkboxes; transcript provenance remains complete but collapsed by default with compact sequence/kind/content rows rather than an unbounded open fieldset.

## Deferred
- Task knowledge extraction/synthesis format: artifact `kind` remains extensible until phase execution defines curated kinds; content and provenance are already immutable.
- Multi-session Task continuation: defer until the one-session Task workflow is validated.
- Automatic reconciliation of pending receipts: defer until external ACP delivery evidence exists; never infer `sent` from age or session shutdown alone.
- Structured evidence curation: raw agent output can now seed a draft, but automated summarization/validation of evidence remains deferred.
- Durable review approval: persist reviewer identity/time/criteria only if a future compliance or multi-user workflow requires an auditable approval record.
