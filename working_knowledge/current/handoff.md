# Handoff

## Current State
- User selected a staged full v1 slice, Linux-first acceptance, and tracking working_knowledge.
- Current branch is setup at 02ee5b4 with step 7 changes ready to commit.
- Step 1 is committed as 6208716 with a verified provenance note.
- Step 2 is committed as d72b673 with a verified provenance note.
- Step 3 is committed as 74ca850 with a verified provenance note.
- Step 4 is committed as f3ed039 with a verified provenance note.
- Step 5 is committed as baaef46 with a verified provenance note.
- Step 6 is committed as 02ee5b4 with a verified provenance note.
- Step 7 documentation, final validation, Tauri identifier fix, and packaging readiness are implemented, tested, reviewed, and ready to commit.

## Next Step
- Commit step 7 with a provenance note, then run final provenance/status verification.

## Commands To Re-Run
- git status --short --branch: verify worktree state.
- rg --files -g '!node_modules' -g '!target' -g '!dist' -g '!build': inspect project files after scaffolding.
- source ~/.cargo/env && rustc --version && cargo --version: verify Rust installation in this shell.
- pkg-config --modversion webkit2gtk-4.1 javascriptcoregtk-4.1 gtk+-3.0 xdo: verify native Tauri dependencies.
- dpkg -L libxdo-dev: verify xdo headers/library because Ubuntu does not provide xdo.pc.
- source ~/.cargo/env && cargo test && cargo clippy -- -D warnings: validate backend.
- npm run typecheck && npm run test -- --run && npm run build: validate frontend.

## Watchouts
- Ensure every implementation plan item has tests, review, one commit, and a provenance note.
- Verify real CLI flags from installed tools before hardcoding adapter behavior.
- PTY force-stop must not emit an exited state after killed; keep the regression test.
- Frontend tests mock src/lib/api.ts; reset Zustand state with useAppStore.getState().resetForTest().
- Browser preview outside Tauri shows backend-unavailable state by design.
- Structured parser fixtures live under src-tauri/src/tests/fixtures/*.jsonl.
- npm run tauri build passed and produced Linux deb/rpm/AppImage bundles.
