# Model Catalog

## Sources
- src-tauri/src/models.rs
- src-tauri/src/storage.rs
- src-tauri/src/commands.rs
- src/App.tsx
- src/App.test.tsx
- docs/linear-tasks.md
- https://developers.openai.com/api/docs/guides/latest-model
- https://platform.claude.com/docs/en/about-claude/models/overview
- https://platform.kimi.ai/docs/models

## Current Shape
- Model providers are `openai`, `anthropic`, and `moonshot`.
- Runtime surfaces such as Codex CLI, Claude Code, API, and ACP are not providers.
- App tiers are `fast`, `mid`, `high`, and `max`; each profile owns its provider-specific parameter mapping.
- The catalog is backend-owned, versioned, and exposed through `list_model_catalog`.
- OpenAI profiles map Luna/Terra/Sol plus reasoning effort to app tiers.
- Anthropic profiles map Haiku/Sonnet/Opus/Fable to app tiers.
- Moonshot profiles use the documented `kimi-k2.6` model with thinking disabled/enabled; unverified Kimi model ids are excluded.

## Summary Boundary
- `generate_project_initialization_summary` receives `initializationId` plus `modelProfileId` in one request object.
- Summary rows persist requested provider/model/tier/parameters, catalog schema version, and knowledge schema version.
- OpenAI profiles are selectable only when `OPENAI_API_KEY` is available to the Tauri process; Anthropic/Moonshot profiles are visible but unavailable until their synthesis adapters exist.
- Successful OpenAI synthesis records `generation_engine=openai_responses_v1`; no deterministic fallback is allowed.
- Existing Summary tables gain provenance columns through idempotent column migration.

## Frontend Flow
- Project Initialize Summary renders a four-tier segmented control and model dropdown.
- The dropdown is scoped to the selected tier and disables unavailable profiles.
- Capability badges display structured output, reasoning control, background mode, API, CLI, and ACP support states from the backend.
- Summary preview and review modal show persisted model selection separately from the actual generation engine.

## Tests
- Rust tests cover catalog availability, request/schema construction, Responses parsing and refusal/error cases, invalid Summary profiles, atomic persistence, stale evidence, approval round-trip, and legacy schema migration.
- Frontend tests cover catalog loading, tier/profile selection, unavailable reasons, command payload, and OpenAI generator provenance.

## Watchouts
- Do not add CLI/ACP model flags until each adapter mapping is validated against the installed runtime.
- Do not send provider credentials through the frontend or persist them in SQLite.
- Keychain credential UX and runtime-agent model selection are not implemented in this slice.
- Revalidate model ids against current provider docs when catalog version changes.
