# Open Questions

## Blocking
- None.

## Non-Blocking
- Should session resume be included in v1 or deferred?
- Should approval UX be centralized in the app or left inside each agent's own terminal prompts for v1?

## Resolved
- Target repository: code-buddy.
- Current branch: init.
- First implementation target: staged full v1 slice.
- First acceptance target: Linux first, with portability preserved.
- working_knowledge policy: track in repository despite the current ignore rule.
- Architecture under current dependency constraint: pause for Tauri/Rust dependencies rather than switch to Electron or proceed with partial validation.
- Dependency status: Rust and native Tauri Linux dependencies are installed enough to proceed.
