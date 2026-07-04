# Repository Notes

## Identity
- name: code-buddy
- path: /home/stefan/code-buddy
- branch: setup

## Architecture
- Tauri v2 application scaffold exists with React/TypeScript frontend and Rust backend entrypoints.
- The product spec recommends Tauri v2, Rust backend, React/TypeScript/Vite frontend, xterm.js, Zustand, SQLite, keyring, and portable-pty.

## Entry Points
- Frontend entry: src/main.tsx renders src/App.tsx.
- Backend entry: src-tauri/src/main.rs calls code_buddy_lib::run().
- Tauri command: app_status returns "ready" for baseline backend validation.

## Tests
- Frontend: Vitest + Testing Library; baseline App shell render test.
- Backend: cargo test; baseline app_status unit test.

## Current Findings
- AGENTS.md defines a strict research, planning, implementation, testing, review, commit, and provenance workflow.
- working_knowledge directories and templates were missing at session start despite being required by AGENTS.md.
- .gitignore excludes working_knowledge, secrets, tools, .codex, .idea, and .git.
- Node 24.13.0 and npm 11.6.2 are installed.
- rustc and cargo are installed under ~/.cargo/bin; source ~/.cargo/env before Rust/Tauri commands in this shell.
- Tauri Linux dependencies installed: webkit2gtk-4.1, javascriptcoregtk-4.1, gtk+-3.0, libxdo-dev, libayatana-appindicator3-dev, librsvg2-dev.
- Ubuntu libxdo-dev provides /usr/include/xdo.h and /usr/lib/x86_64-linux-gnu/libxdo.so but no xdo.pc.
- .gitignore now ignores node_modules, dist, and src-tauri/target while allowing working_knowledge to be tracked.
- Installed agent CLIs: Codex CLI 0.128.0, Claude Code 2.1.201, Kimi 1.44.0.

## Constraints
- Every implementation plan item must include tests and an adversarial review.
- Every completed implementation plan item must be committed with a provenance git note under refs/notes/provenance.
- The full v1 spec is too large to safely implement as one plan item.
- Tauri validation should source ~/.cargo/env before npm/cargo commands.
