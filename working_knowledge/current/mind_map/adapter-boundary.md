# Adapter Boundary

## Sources
- src-tauri/src/adapters.rs
- src-tauri/src/session.rs
- src-tauri/src/errors.rs
- docs/linear-tasks.md

## Current Shape
- AgentAdapter is the backend trait boundary for CLI-specific behavior.
- AgentRegistry lists and resolves compiled-in adapters.
- Built-in adapter ids are codex, claude_code, and kimi.
- FakeAdapter exists inside adapter unit tests to validate registry and capability edge cases without real CLIs.
- AppError has AdapterNotFound for registry resolution failures.

## Interface Coverage
- Detection: AgentAdapter::detect uses a BinaryResolver abstraction.
- Capabilities: AgentCapabilities tracks interactive PTY, headless, structured output, and native AGENTS.md support.
- Command construction: AgentAdapter::build_command returns an AgentCommand that can become a portable-pty CommandBuilder.
- Input encoding: AgentAdapter::encode_input supports raw terminal bytes and newline-terminated prompt input.
- Structured parsing hook: AgentAdapter::parse_structured_chunk currently returns Unsupported by default.
- AGENTS.md delivery: AgentsMdDelivery records native, prompt-prefix, unsupported, or unknown strategies.

## Current Integration
- start_codex_session is still a temporary smoke-test command.
- The Codex launch path now uses CodexAdapter for detection and command construction.
- Claude Code and Kimi adapters are metadata/command-boundary placeholders until AIA-005 and AIA-007.
- Codex structured/headless/native AGENTS.md capabilities remain Unknown until AIA-006/AIA-010 validation.

## Tests
- Adapter tests cover built-in registry listing/resolution.
- Adapter tests cover default registry behavior.
- Adapter tests cover missing adapter errors.
- Adapter tests cover detection available/missing with a fake resolver.
- Adapter tests cover Codex smoke-test command construction.
- Adapter tests cover raw/prompt input encoding and capability edge cases.

## Watchouts
- Do not hardcode unvalidated CLI flags for Claude Code, Codex, or Kimi before their adapter tasks.
- AIA-004 should expose detection through commands/UI rather than duplicating resolver logic.
- AIA-010 should replace Unknown AGENTS.md delivery decisions with verified native or injection behavior.
