# Handoff

## Current State
- AIadne is a working Tauri desktop MVP with React/TypeScript UI, Rust backend, SQLite persistence, PTY fallback, and structured ACP sessions.
- Workspace and repository selection drive runtime cwd; transcripts and manual Knowledge Cards are persisted and replayable.
- Project Initialize supports Preflight, Facts, Markdown analysis, Interview guardrails, Summary synthesis/approval, and source-backed Knowledge Unit publication.
- A deterministic selector ranks and packs approved Knowledge Units under a strict character budget and exposes inclusion/exclusion reasons in a read-only preview.
- ACP prompt sending still injects only explicitly attached manual Knowledge Cards; generated selector output is not silently sent.
- The visible product identity, responsive shell, Geist typography, Ariadne Atelier colors, overlays, state notices, and action hierarchy are implemented.

## Next Step
- Run a real Tauri end-to-end acceptance test, then plan explicit user-approved Knowledge Unit injection into ACP prompts; continue-from-transcript follows after that boundary is stable.

## Commands To Re-Run
- `npm run typecheck && npm run test -- --run && npm run build`: validate the frontend.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check && cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`: validate the Rust backend.
- `npm run tauri dev`: manually validate the real desktop runtime and local ACP/PTY integrations.
- `git diff --check`: validate patch hygiene.

## Watchouts
- Do not merge generated Knowledge Units with user-authored Knowledge Cards without an explicit migration decision.
- Preserve exact source labels and immutable unit content through selection and future prompt injection.
- `src/App.tsx` is a large single-screen coordinator; decompose it before layering several more stateful workflows into it.
- The Vite production bundle currently emits a non-fatal >500 kB chunk warning.
