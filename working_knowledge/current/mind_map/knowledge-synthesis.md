# Knowledge Synthesis

## Sources
- src-tauri/src/synthesis.rs
- src-tauri/src/storage.rs
- src-tauri/src/commands.rs
- src-tauri/src/models.rs
- src/App.tsx
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/guides/migrate-to-responses

## Flow
- Unified Task Context Preview
  - approved Project Knowledge Units
  - transcript-attached manual Knowledge Cards
  - current Task phase artifacts in canonical order
  - one strict character budget with source/reason audit trail
  - read-only boundary; no automatic ACP injection
  - explicit send freezes the rendered preview and keeps the persisted user prompt unchanged
- `ProjectStore::prepare_project_initialization_synthesis` validates the model profile and loads selected repositories, Facts, Markdown findings, and Interview guardrails into owned context.
- The SQLite mutex is released before provider I/O.
- `SynthesisProviderRegistry` resolves the selected profile provider and owns provider availability used by the catalog UI.
- `SynthesisProvider` receives provider-neutral evidence and returns a neutral knowledge draft plus an auditable generation engine.
- `OpenAiResponsesProvider` maps OpenAI model id and reasoning effort, then calls `POST /v1/responses` with `store=false` and strict `text.format` JSON Schema.
- After provider parsing, a provider-neutral validator checks every source marker against the exact evidence context and rejects uncited material sections unless they explicitly state missing evidence or a need for confirmation.
- The parser accepts only a completed response with valid non-empty structured sections; API errors, refusals, incomplete output, and malformed JSON are explicit `synthesis` errors.
- `ProjectStore::persist_project_initialization_summary` compares current evidence with the prepared context and atomically replaces the Summary only when evidence is unchanged.
- Summary approval atomically derives line-sized `knowledge_units` plus ordered `knowledge_unit_sources`; UUIDv5 identities are stable for repeated approval of the same Summary.
- Uncited lines block approval and publish nothing; explicit uncertainty becomes `needs_confirmation` with zero confidence.
- ATX Markdown headings inside structured Summary fields are ignored as presentation structure; uncited bullets/prose still block the transaction. Provider instructions also forbid redundant field headings.
- OpenAI requests include the sorted exact source-label allowlist. A source-invalid first draft triggers one correction request with bounded JSON diagnostic feedback; a second failure remains explicit and nothing invalid is persisted.
- Summary Review loads initialization-scoped units and exposes their type, topic, status, confidence, and exact source keys before any prompt-selection integration exists.

## Next Selector Boundary
- Input: immutable active Knowledge Units plus task text, selected project/repository, and optional relevant paths/modules.
- Behavior: deterministically filter, rank, order, include, exclude, and pack units; never rewrite unit content or provenance.
- Priority: mandatory rules and constraints first, then repository/path-matched architecture and commands, then task-specific facts.
- Budget: enforce a strict character/token budget with deterministic tie-breaking and explicit per-unit inclusion/exclusion reasons.
- Preview: show exactly what will be sent to the agent, why each unit was selected, and what was omitted by relevance or budget.
- Embeddings remain deferred until the deterministic selector can be tested and measured as a baseline.
- Implemented baseline: Rust selector returns stable included/excluded entries, reason codes, scores, and exact rendered-character budget; frontend `Preview Context` exposes this output without changing ACP prompts.

## Security And Provenance
- Repository evidence is untrusted prompt data; system instructions tell the model not to follow embedded directives.
- `OPENAI_API_KEY` is read only by Rust from the Tauri process environment.
- Keys are not exposed to React, logged, or stored in SQLite.
- Successful rows record requested model metadata and `generation_engine=openai_responses_v1`.
- There is no deterministic fallback.

## Deferred
- Selector implementation and prompt integration, retry/cancellation/background execution, usage/cost display, keychain account settings, and Anthropic/Moonshot clients.
- Every future provider must reject cross-provider profiles locally as well as relying on registry routing.
