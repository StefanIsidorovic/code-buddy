# ACP Transport

## Sources
- External: https://agentclientprotocol.com/get-started/introduction
- External: https://agentclientprotocol.com/get-started/architecture
- External: https://agentclientprotocol.com/get-started/agents
- External: https://agentclientprotocol.com/get-started/registry
- External: https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json
- External: https://agentclientprotocol.com/protocol/v1/overview
- External: https://agentclientprotocol.com/protocol/v1/transports
- Local: src-tauri/src/acp.rs
- Local: src-tauri/src/commands.rs
- Local: src/App.tsx
- Local: src/App.test.tsx
- Local: docs/linear-tasks.md

## Plain Meaning
- ACP means Agent Client Protocol.
- In AIadne terms, AIadne is the client and a coding agent is the server-like subprocess.
- PTY sends terminal bytes; ACP sends structured JSON-RPC messages.
- ACP is useful when an agent supports editor-style events such as messages, tool calls, diffs, permissions, and progress updates.
- PTY remains required as the fallback for terminal-first CLIs and TUI agents.

## Current Fit In AIadne
- ACP is now a second backend runtime beside the PTY runtime.
- src-tauri/src/acp.rs owns fake ACP subprocess lifecycle, JSON-RPC line framing, initialization, session creation, prompt sending, cancellation, event buffering, and cleanup.
- Adapter descriptors now report transport support with pty and acp_stdio statuses.
- The temporary frontend has an ACP Test panel and renders ACP events as structured UI list items, not through xterm.
- The temporary frontend has an ACP Registry panel that shows curated candidate status, command preview, and install guidance.
- PTY remains the fallback path for terminal-first CLIs.

## First Slice
- AIA-017 first slice is implemented locally with a fake ACP stdio fixture.
- Proven: initialize, session/new, session/prompt, session/update drain, malformed JSON handling, empty prompt rejection, missing session error, process cleanup, and PTY regression coverage.
- Built-in Codex, Claude Code, and Kimi ACP support remains Unknown until real adapter validation.
- AIA-018 adds side-effect-free ACP registry discovery for codex-acp, claude-acp, kimi, and gemini candidates.
- npx candidates are reported as installable when npx exists; binary candidates are ready only when the executable is present.
- Candidate selection exists in the frontend as the chosen launch target, but selection itself does not start an ACP process.
- AIA-019 adds Start Selected ACP, which turns the selected candidate id into a backend-owned launch command and reuses the existing initialize/session/new flow.
- Real Codex ACP emits tokenized agent_message_chunk updates plus technical available_commands/session_info updates; backend now merges adjacent message chunks and filters those technical updates from the UI event list.
- Real Codex ACP can emit content as an array of text blocks and can send agent_thought_chunk updates; backend normalizes those into readable Agent/Plan events instead of raw notice JSON.
- AIA-020 keeps Start Selected ACP as the generic launch action and tests a non-default launchable candidate.
- Candidate selection is disabled while an ACP session is running so the selected label does not drift from the active session source.
- AIA-022 passes selected Workspace cwd into fake ACP and selected registry ACP launches.
- AIA-023 frontend display coalesces adjacent Agent/Plan events into larger readable blocks; backend event storage remains unchanged.
- AIA-024 persists ACP transcript sessions and ordered ACP events in SQLite through ProjectStore.
- The frontend records user prompt events plus drained backend-normalized ACP events, then shows a minimal Session History list.
- AIA-025 lets users open stored ACP transcript events from Session History without starting an ACP process.
- AIA-026 keeps saved transcript replay isolated when switching between stored sessions.
- AIA-027 normalizes saved transcript replay into Question/Answer rows.
- AIA-028 keeps frontend ACP drain polling tied to the active transcript id so streamed Codex chunks are not lost before persistence.
- AIA-031 injects checked Knowledge Cards into the ACP prompt text sent to the agent while transcript history stores the original user prompt.
- Reviewed unified context uses a dedicated backend dispatch command: it persists a pending Task receipt before `session/prompt`, then records stop reason or failure without rewriting transcript prompt identity.
- Task Dispatch History reads those receipts without contacting ACP; manual stale recovery cannot claim delivery and the backend blocks `pending -> failed` while that ACP session is still running.
- Controlled phase Run uses the same single-prompt concurrency boundary, persists its exact instruction as a transcript user event, and rejects a Task/transcript identity mismatch before ACP dispatch.
- The dedicated phase-run Tauri command persists intent before `session/prompt`, then records stop reason or failure; process uncertainty remains conservatively pending.
- Pending phase-run recovery checks live ACP manager state before allowing a failed resolution and never manufactures a sent outcome.
- Agent-to-client `session/request_permission` requests are routed before generic response IDs, held in an opaque per-session queue, and exposed through typed list/respond commands.
- The Agent view polls pending permissions independently while `session/prompt` blocks; users must select an offered choice, and graceful Stop sends cancelled outcomes.
- Each child keeps only a 4 KiB stderr tail; request-exit errors briefly synchronize with pipe closure and include that tail so npx/auth/runtime startup failures are actionable without unbounded logging.
- npx-based adapters bootstrap from the OS temporary directory rather than repository cwd, isolating npm from project `package.json`; the selected repository remains authoritative in `session/new.cwd`, while binary adapters retain process cwd compatibility.
- Frontend ACP drains continue during pending prompts through a serialized coordinator; transcript affinity is fixed at prompt start so view changes cannot redirect persisted output.
- Controlled phase capture spans every live drain and the final flush, then deduplicates persisted agent message/thought IDs before linking the run receipt.
- Persisted ACP transcripts retain a separate candidate/external-session recovery identity; backend recovery initializes that adapter, requires `agentCapabilities.loadSession`, sends `session/load` with the saved id and repository cwd, and reuses normal replay/model/prompt handling without creating a replacement conversation.
- Session History exposes explicit Resume; the recovery hook guards active/concurrent/stale loads, consumes historical replay into UI without re-appending it, activates the existing transcript/Task, and lets only subsequent events return to normal persistence.
- The process harness proves the restart boundary explicitly: dropping the first manager removes its local PID, a fresh manager loads the exact external id, replay drains once, and the replacement process accepts a follow-up prompt.

## Watchouts
- ACP stdout must contain only valid ACP JSON-RPC messages; logs belong on stderr.
- ACP does not remove the need for xterm because some agents still work only through terminal UI.
- Remote ACP support is still not the first local target; start with stdio.
- ACP should not be mixed into the existing PTY SessionManager until the boundary is clear.
- The fake ACP fixture is shell-based for local Linux validation; replace with real ACP agent process validation before claiming support for a real CLI.
- Only `session/request_permission` client-side ACP requests are implemented; other future agent-to-client methods still require explicit routing and protocol tests.
- Registry discovery must not run npx or download packages; real adapter launch needs an explicit later step and user approval if network/package install is required.
- Start Selected ACP is now that explicit launch action; npx candidates may download packages on first launch.
- Avoid per-agent direct ACP launch buttons unless a later product design explicitly requires them.
- Passing initialize/session/new does not yet mean a candidate is fully product-supported; prompt, auth, permission, and tool-call behavior still need adapter-specific validation.
- ACP request timeout is currently 30 seconds for smoke testing; long-running real prompts may need a later streaming/lifecycle refinement.
- Blocking ACP start/send/stop/list operations are run via Tauri async spawn_blocking so the desktop window stays responsive during real agent waits.
- Control requests use a short timeout; session/prompt uses a longer timeout for real Codex work.
- Response waits poll child process exit so stop/kill or agent crashes release pending waits promptly.
- Each ACP session allows only one prompt in flight at a time.
- ACP launch cwd is project-selected when available, and transcript sessions can link to that selected project.
- Attached Knowledge Cards are app-level prompt context, not ACP protocol metadata; future adapter-specific context APIs may replace this string injection if they become available.
- UI-level event coalescing is a readability layer; transcript persistence now also coalesces adjacent agent/plan chunks before append.
- Transcript history now supports isolated minimal stored event replay with question/answer labels; rich chat/tool-call transcript UI is still deferred.
