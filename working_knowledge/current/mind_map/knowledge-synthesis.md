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
- `ProjectStore::prepare_project_initialization_synthesis` validates the model profile and loads selected repositories, Facts, Markdown findings, and Interview guardrails into owned context.
- The SQLite mutex is released before provider I/O.
- `synthesize_project_initialization` maps the OpenAI profile to model id and reasoning effort, then calls `POST /v1/responses` with `store=false` and strict `text.format` JSON Schema.
- The parser accepts only a completed response with valid non-empty structured sections; API errors, refusals, incomplete output, and malformed JSON are explicit `synthesis` errors.
- `ProjectStore::persist_project_initialization_summary` compares current evidence with the prepared context and atomically replaces the Summary only when evidence is unchanged.

## Security And Provenance
- Repository evidence is untrusted prompt data; system instructions tell the model not to follow embedded directives.
- `OPENAI_API_KEY` is read only by Rust from the Tauri process environment.
- Keys are not exposed to React, logged, or stored in SQLite.
- Successful rows record requested model metadata and `generation_engine=openai_responses_v1`.
- There is no deterministic fallback.

## Deferred
- Source-reference validator pass, retry/cancellation/background execution, usage/cost display, keychain account settings, and Anthropic/Moonshot clients.
