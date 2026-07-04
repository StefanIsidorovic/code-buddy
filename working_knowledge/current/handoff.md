# Handoff

## Current State
- User selected a staged full v1 slice, Linux-first acceptance, and tracking working_knowledge.
- Current branch is setup at 74ca850.
- Step 1 is committed as 6208716 with a verified provenance note.
- Step 2 is committed as d72b673 with a verified provenance note.
- Step 3 is committed as 74ca850 with a verified provenance note.
- Step 4 PTY session manager and IPC are implemented, tested, reviewed, and ready to commit.

## Next Step
- Commit step 4 with a provenance note, then implement step 5 desktop UI and frontend state.

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
