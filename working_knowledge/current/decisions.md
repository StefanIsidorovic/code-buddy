# Decisions

## Confirmed
- Product identity: display AIadne in the UI and Tauri window while retaining internal `code-buddy` names and `com.codebuddy.app` until a deliberate migration.
- Runtime boundary: use structured ACP as the primary agent interaction and keep PTY as the compatibility fallback.
- Workspace boundary: projects own repositories; the selected repository supplies runtime cwd.
- Persistence: SQLite owns projects, repositories, initialization artefacts, transcripts, Knowledge Cards, summaries, and generated Knowledge Units.
- Knowledge boundary: manual Knowledge Cards remain user-authored prompt attachments; approved summaries publish separate immutable, source-backed Knowledge Units.
- Validation: unknown or generic synthesis source labels are rejected; one bounded provider correction may retry without remapping citations.
- Selection: use deterministic mandatory/repository/path/lexical ranking, stable ordering, explicit reasons, and a configurable 6000-character default budget before considering embeddings.
- Prompt boundary: selector output remains preview-only until the user can explicitly approve the exact generated context sent to ACP.
- UI identity: use the local AIadne thread/maze mark, Geist Sans, Ariadne Atelier semantic colors, a light parchment workspace, and fixed dark command rail/terminal regions.
- Accessibility: preserve semantic text identity, focus-visible states, explicit disabled colors, reduced-motion behavior, accessible state notices, and named icon controls.
- Documentation: LOCAL_PROGRESS.md becomes tracked because the user explicitly requested committing the full reconciled project record.

## Deferred
- Automatic or session-sticky Knowledge Unit prompt injection: pending explicit UX and transcript-provenance design.
- Continue-from-transcript context strategy: pending a bounded raw-turn versus summary decision.
- Embeddings and semantic retrieval: pending measurement of deterministic selector quality.
- Internal package, crate, application identifier, and storage migration: pending a dedicated compatibility plan.
- Platform-specific AIadne icon pack, packaging, and release automation: pending post-MVP acceptance testing.
