# Handoff

## Current State
- Plan step 45 connects Project Initialize Summary to OpenAI Responses structured synthesis.
- Rust prepares owned provider-neutral evidence, releases SQLite before network I/O, parses strict structured output, rejects stale evidence, and atomically persists `openai_responses_v1` drafts.
- `OPENAI_API_KEY` is read only from the Tauri process environment; Anthropic/Moonshot synthesis profiles remain visible but unavailable.
- Final validation passes: Rust fmt, 68 Rust tests, clippy with warnings denied, TypeScript typecheck, 29 frontend tests, production build, and diff checks.
- Live provider smoke test is not run because the current process has no `OPENAI_API_KEY`.
- Worktree still contains pre-existing overlapping uncommitted Project Initialize/UI changes, so a valid isolated provenance commit remains blocked.

## Next Step
- Manually launch with `OPENAI_API_KEY` and confirm a generated Summary reports `openai_responses_v1`.
- After manual validation, implement source-reference validation and approved-profile injection before adding Anthropic/Moonshot synthesis clients.

## Commands To Re-Run
- `OPENAI_API_KEY=your_key npm run tauri dev`: launch the executable OpenAI synthesis path.
- `cargo fmt --check && cargo test && cargo clippy -- -D warnings`: validate Rust.
- `npm run typecheck && npm run test -- --run && npm run build`: validate frontend.
- `git diff --check`: validate patch whitespace.

## Watchouts
- Never treat requested model provenance as proof of execution; only `generation_engine=openai_responses_v1` means OpenAI output was persisted.
- Provider/API failures must not fall back to deterministic content or replace the previous Summary.
- Do not expose provider keys to React or SQLite.
- Resolve the dirty-worktree provenance blocker before claiming a step 45 commit/note.
