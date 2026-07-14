# Handoff

## Current State
- Summary provider output is validated against the exact initialization evidence allowlist before persistence.
- Approved summaries retain their reviewable sections and also publish independently retrievable, source-backed Knowledge Units.
- Manual Knowledge Cards remain whole-body prompt attachments.
- Backend Knowledge Unit publication is committed as 87f506e; approval atomically publishes deterministic source-backed units and rejects uncited lines.
- Summary Review now previews approved units with status, confidence, and exact source keys; frontend work is committed as a65c187.

## Next Step
- Implement a deterministic task-context selector that filters, ranks, and packs Knowledge Units by task and repository/path relevance, mandatory-rule precedence, and strict budget, while explaining every inclusion/exclusion in a preview.

## Commands To Re-Run
- `cd src-tauri && cargo fmt --check && cargo test && cargo clippy -- -D warnings`: validate backend.
- `npm run typecheck && npm run test -- --run && npm run build`: validate frontend after step 6.2.
- `git diff --check`: validate patch hygiene.

## Watchouts
- Preserve source markers exactly enough to audit a unit back to initialization evidence.
- Keep approval and replacement of a Summary's units in one SQLite transaction.
- Do not alter legacy Knowledge Card attachment or prompt construction in this task.
- The selector may select and order units, but must not silently rewrite their content or provenance.
