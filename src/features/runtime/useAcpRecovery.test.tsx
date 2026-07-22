import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptSessionInfo } from "../../types/domain";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
import { useAcpRecovery } from "./useAcpRecovery";

const transcript: TranscriptSessionInfo = { id: "t1", projectId: "p1", runtime: "acp", source: "Codex",
  title: "Saved", startedAt: 1, updatedAt: 2, eventCount: 4 };

describe("useAcpRecovery", () => {
  beforeEach(() => invoke.mockReset());

  it("loads exact recovery identity and consumes replay without transcript persistence", async () => {
    invoke.mockImplementation((command) => command === "get_transcript_acp_identity"
      ? Promise.resolve({ transcriptSessionId: "t1", candidateId: "codex-acp",
        agentSessionId: "agent1", createdAt: 1 })
      : command === "load_acp_registry_session"
        ? Promise.resolve({ id: "local1", state: "running", agentSessionId: "agent1" })
        : command === "drain_acp_events"
          ? Promise.resolve([{ kind: "agent_message", content: "restored" }]) : Promise.resolve([]));
    const reportError = vi.fn();
    const { result } = renderHook(() => useAcpRecovery({ cwd: "/repo", scopeKey: "p1",
      sessionUsable: false, reportError }));
    await act(async () => {
      const recovered = await result.current.resume(transcript);
      expect(recovered?.replay).toEqual([{ kind: "agent_message", content: "restored" }]);
    });
    expect(invoke).toHaveBeenCalledWith("get_transcript_acp_identity", { transcriptSessionId: "t1" });
    expect(invoke).toHaveBeenCalledWith("load_acp_registry_session", { request: {
      candidateId: "codex-acp", agentSessionId: "agent1", cwd: "/repo",
    } });
    expect(invoke).not.toHaveBeenCalledWith("append_transcript_events", expect.anything());
  });

  it("reports legacy rows and locks resume while a session is live", async () => {
    invoke.mockResolvedValue(null); const reportError = vi.fn();
    const { result, rerender } = renderHook(({ usable }) =>
      useAcpRecovery({ scopeKey: "p1", sessionUsable: usable, reportError }),
      { initialProps: { usable: false } });
    await act(() => result.current.resume(transcript));
    expect(reportError).toHaveBeenCalledWith(expect.stringContaining("predates ACP recovery"));
    expect(result.current.error).toContain("predates ACP recovery");
    invoke.mockClear(); rerender({ usable: true });
    await act(() => result.current.resume(transcript));
    expect(invoke).not.toHaveBeenCalled();
  });

  it("stops a loaded process when the workspace changes before recovery completes", async () => {
    let resolveLoad: (value: object) => void = () => undefined;
    const load = new Promise<object>((resolve) => { resolveLoad = resolve; });
    invoke.mockImplementation((command) => command === "get_transcript_acp_identity"
      ? Promise.resolve({ transcriptSessionId: "t1", candidateId: "codex-acp",
        agentSessionId: "agent1", createdAt: 1 })
      : command === "load_acp_registry_session" ? load : Promise.resolve({ state: "killed" }));
    const reportError = vi.fn();
    const { result, rerender } = renderHook(({ scopeKey }) => useAcpRecovery({ cwd: "/repo", scopeKey,
      sessionUsable: false, reportError }), { initialProps: { scopeKey: "p1" } });
    let pending: Promise<unknown> = Promise.resolve();
    act(() => { pending = result.current.resume(transcript); });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("load_acp_registry_session", expect.anything()));
    rerender({ scopeKey: "p2" });
    await act(async () => { resolveLoad({ id: "local1", state: "running", agentSessionId: "agent1" }); await pending; });
    expect(invoke).toHaveBeenCalledWith("stop_acp_session", { sessionId: "local1", force: true });
  });
});
