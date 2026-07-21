# Repository Notes

## Identity
- name: code-buddy (visible product: AIadne)
- path: /home/katarina/projects/AIadne
- branch: new/start

## Architecture
- Tauri 2 desktop application with a React 19/TypeScript/Vite frontend and Rust backend.
- `src/App.tsx` coordinates the single-screen workspace, initialization, runtime, history, and dialog workflows; `src/App.css` owns the visual system.
- Rust modules separate PTY sessions, ACP transport, agent adapters, SQLite storage, model catalog, synthesis providers, Knowledge Unit selection, commands, and errors.
- SQLite persists projects, repositories, initialization artefacts, summaries, Knowledge Units, ACP transcripts, and manual Knowledge Cards.
- Structured ACP is the primary runtime surface; xterm-backed PTY remains the compatibility fallback.

## Entry Points
- `src/main.tsx`: React bootstrap.
- `src/App.tsx`: application UI and frontend orchestration.
- `src-tauri/src/main.rs`: desktop executable.
- `src-tauri/src/lib.rs`: Tauri builder, state, plugins, and command registration.
- `src-tauri/src/commands.rs`: frontend/backend command boundary.

## Tests
- `src/App.test.tsx` contains 38 mocked integration-style frontend tests covering workspace, repositories, initialization, summaries, Knowledge Units, selector preview, transcripts, Knowledge Cards, ACP, Task creation/reuse/failure isolation and assessment rendering, PTY, and responsive product-shell contracts.
- Rust has 92 unit/integration tests across PTY/ACP lifecycle and model configuration, adapters, storage, synthesis, model catalog, deterministic context selection, Task persistence, complexity classification, overrides, audit history, and migration.
- Current validation commands: `npm run typecheck`; `npm run test -- --run`; `npm run build`; `cargo fmt --manifest-path src-tauri/Cargo.toml --check`; `cargo test --manifest-path src-tauri/Cargo.toml`; `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`.

## Current Findings
- Workspace projects own repositories; the selected repository path is passed as PTY/ACP cwd.
- Project Initialize persists selected scope, Facts, Markdown findings, Interview guardrails, provider-routed Summary drafts, approval status, and requested-model provenance.
- OpenAI Responses is the implemented synthesis provider; exact source allowlists and one bounded correction attempt protect citation integrity.
- Summary approval atomically publishes deterministic, source-backed Knowledge Units; valid ATX headings are treated as structure, while uncited claims still block approval.
- `select_project_task_context` deterministically prioritizes mandatory rules, repository/path scope, and lexical matches under an exact character budget; the frontend exposes an auditable preview.
- Generated selector context is not yet sent to ACP. `Send ACP` continues to inject only explicitly attached manual Knowledge Cards and persists the original user prompt.
- The first project-owned ACP prompt now creates one persistent Task before transcript/agent side effects; follow-ups reuse it by transcript id, and new Tasks start in ordered analysis, planning, execution, and review phases.
- Project-less ACP remains a compatibility smoke path without Task persistence; project-owned prompts are blocked if transcript or Task persistence fails.
- New Tasks receive a versioned deterministic quick/standard/complex assessment in Rust: bounded UI/content work can be quick, ambiguous or bounded two-layer work is standard, and security/payment, migration, three-layer, or explicit vertical work is complex.
- Task rows retain immutable initial and effective complexity fields for fast reads; `task_complexity_changes` stores append-only system/user history, and validated overrides preserve the initial assessment.
- ACP Controls renders the live transcript's Task assessment read-only; project switches clear stale render state immediately and saved/other transcript Tasks are not presented as active.
- ACP session creation retains agent-advertised model options; the UI changes the Coding model through `session/set_config_option`, validates choices against that session, and leaves Summary selection and global Codex config unchanged.
- The ACP runtime panel has an accessible local chevron toggle; collapsed mode removes model, Task, and result details from layout/accessibility flow while preserving Prompt/Send and active-session Drain/Stop actions.
- The ACP chevron uses a 42 px invisible hit target with a prominent 24 px heavy arrow; persistent border, background, radius, and shadow chrome are removed.
- ACP transcripts are persisted, coalesced for readable replay, filterable, and renameable; continue-from-transcript is not implemented.
- AIadne is the visible Tauri/window and sidebar identity; internal package/crate names and `com.codebuddy.app` intentionally remain unchanged.
- The active visual system uses the local AIadne SVG mark, Geist Sans, Ariadne Atelier semantic colors, responsive navigation, accessible state notices, consistent overlays, and reduced-motion-safe transitions.
- `src/App.tsx` is over 4,500 lines and is the primary maintainability risk before several more stateful frontend workflows are added.
- Pure prompt, transcript, event, command, path, and error presentation logic now lives in `src/lib/presentation.ts` with direct unit coverage; this is the first seam in the staged `App.tsx` decomposition.
- Shared notices/icons live under `src/components/ui`; global notifications now use a bounded, timer-safe Zustand store and dedicated viewport under `src/features/notifications`, while workflow-local drafts remain in App pending feature extraction.
- Frontend Rust/Tauri DTO and domain unions now have one dependency-free source of truth in `src/types/domain.ts`; App consumes them through type-only imports and representative nested contracts have compile-time tests.
- ACP Controls now lives in `src/features/runtime/AcpRuntimePanel.tsx` behind a typed view-model/callback API; it owns presentation only and imports neither Tauri nor transcript/project orchestration.
- Session Output now lives in `src/features/runtime/SessionOutputPanel.tsx`; App retains xterm/event refs, polling, coalescing, scroll effects, transcript selection, and live-view state while the feature owns PTY/ACP output markup.
- Fake ACP is no longer a frontend control or public Tauri command; selected registry candidates are the only product ACP launch path, while manager-level fake subprocesses remain deterministic Rust protocol fixtures.
- `docs/product-roadmap.md` defines the frontend modularization, evidence-aware Task workflow, multi-agent runtime, execution/review harness, Git delivery intelligence, and measured-learning sequence beyond Conductor.

## Constraints
- Preserve source markers and generated Knowledge Unit content/provenance exactly through selection and future prompt integration.
- Keep Task lifecycle/knowledge separate from transcript events, project Knowledge Units, and manual Knowledge Cards.
- Treat classifier confidence as a prompt-only baseline; analysis confirmation and measured calibration are deferred, and historical assessment versions must remain interpretable.
- Keep manual Knowledge Cards and generated Knowledge Units separate until an explicit migration decision.
- Do not hold the SQLite lock during provider network calls; reject stale synthesis results when evidence changes.
- Keep credentials in the Rust process and out of React/SQLite.
- Real CLI/ACP behavior depends on locally installed tools and PATH; browser-only Vite mode cannot validate Tauri commands.
- The Vite bundle currently has a known non-fatal >500 kB chunk warning.
- Linux-first fake CLI/runtime helpers still need platform hardening before cross-platform release.
