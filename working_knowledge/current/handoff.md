# Handoff

## Current State
- Repository research completed for the initial empty code-buddy repo.
- working_knowledge templates and current files have been initialized locally.
- User selected a staged full v1 slice, Linux-first acceptance, and tracking working_knowledge.
- Rust and native Tauri Linux dependencies are installed enough to proceed.
- Current branch is setup at 92ebef7.
- Step 1 is committed as 6208716 with a verified provenance note.
- Step 2 backend domain/storage/secrets/adapters is implemented, tested, and ready to commit.

## Next Step
- Commit step 2 with a provenance note, then implement step 3 AGENTS.md resolution and delivery.

## Commands To Re-Run
- git status --short --branch: verify worktree state.
- rg --files -g '!node_modules' -g '!target' -g '!dist' -g '!build': inspect project files after scaffolding.
- source ~/.cargo/env && rustc --version && cargo --version: verify Rust installation in this shell.
- pkg-config --modversion webkit2gtk-4.1 javascriptcoregtk-4.1 gtk+-3.0 xdo: verify native Tauri dependencies.
- dpkg -L libxdo-dev: verify xdo headers/library because Ubuntu does not provide xdo.pc.

## Watchouts
- Do not implement product code before a detailed plan is confirmed.
- Ensure every implementation plan item has tests, review, one commit, and a provenance note.
- Verify real CLI flags from installed tools before hardcoding adapter behavior.
