# Adapter Boundary

## Sources
- src-tauri/src/adapters.rs
- src-tauri/src/commands.rs
- src-tauri/src/session.rs
- src-tauri/src/errors.rs
- docs/linear-tasks.md

## Current Shape
- AgentAdapter is the backend trait boundary for CLI-specific behavior.
- AgentRegistry lists and resolves compiled-in adapters.
- Built-in adapter ids are codex, claude_code, and kimi.
- Agent doctor reports expose installed, missing, and error states for each adapter.
- Adapter descriptors expose transport support for pty and acp_stdio.
- FakeAdapter exists inside adapter unit tests to validate registry and capability edge cases without real CLIs.
- AppError has AdapterNotFound for registry resolution failures.

## Interface Coverage
- Detection: AgentAdapter::detect uses a BinaryResolver abstraction.
- Doctor reports: AgentAdapter::doctor_report combines binary detection, version lookup, install hint, and status.
- Version lookup: SystemVersionRunner runs `<binary> --version`, times out after 2 seconds, and reports errors instead of panicking.
- Capabilities: AgentCapabilities tracks interactive PTY, headless, structured output, and native AGENTS.md support.
- Transports: AgentTransportCapabilities tracks PTY and ACP stdio support separately from higher-level agent capabilities.
- Command construction: AgentAdapter::build_command returns an AgentCommand that can become a portable-pty CommandBuilder.
- Input encoding: AgentAdapter::encode_input supports raw terminal bytes and newline-terminated prompt input.
- Structured parsing hook: AgentAdapter::parse_structured_chunk currently returns Unsupported by default.
- AGENTS.md delivery: AgentsMdDelivery records native, prompt-prefix, unsupported, or unknown strategies.

## Current Integration
- The model catalog is a separate backend boundary; provider ids do not reuse Codex/Claude/Kimi adapter ids.
- Summary `SynthesisProvider` and runtime `AgentAdapter` are separate extension points because API synthesis and CLI/ACP sessions have different lifecycle and transport contracts.
- Catalog CLI/ACP capability states stay Unknown until adapter-specific model mapping is validated.
- start_codex_session is still a temporary smoke-test command.
- The Codex launch path now uses CodexAdapter for detection and command construction.
- list_agent_doctor_reports exposes registry doctor status through Tauri.
- Doctor UI displays transport support from AgentAdapterDescriptor instead of inferring it in the frontend.
- Claude Code and Kimi adapters are metadata/command-boundary placeholders until AIA-005 and AIA-007.
- Codex structured/headless/native AGENTS.md capabilities remain Unknown until AIA-006/AIA-010 validation.
- Built-in ACP stdio support remains Unknown until each real CLI is validated.

## Tests
- Adapter tests cover built-in registry listing/resolution.
- Adapter tests cover default registry behavior.
- Adapter tests cover missing adapter errors.
- Adapter tests cover detection available/missing with a fake resolver.
- Adapter tests cover doctor installed/missing/error states with fake resolver/version runner.
- Adapter tests cover Codex smoke-test command construction.
- Adapter tests cover raw/prompt input encoding and capability edge cases.
- Adapter tests cover transport metadata edge cases.

## Watchouts
- Do not hardcode unvalidated CLI flags for Claude Code, Codex, or Kimi before their adapter tasks.
- Do not translate app model tiers into CLI/ACP arguments in the frontend; adapters own that future mapping.
- Doctor UI should keep using list_agent_doctor_reports instead of duplicating resolver/version logic in frontend.
- AIA-010 should replace Unknown AGENTS.md delivery decisions with verified native or injection behavior.
- Do not mark ACP stdio Supported for a real adapter until an actual ACP subprocess path passes initialize/session/prompt tests.
