import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskInfo, TranscriptEventInfo, TranscriptSessionInfo } from "../../types/domain";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
import { useTranscriptWorkspace } from "./useTranscriptWorkspace";

const session = (id: string): TranscriptSessionInfo => ({ id, projectId: "p1", runtime: "acp", source: "Codex",
  title: id, startedAt: 1, updatedAt: 1, eventCount: 0 });
const task: TaskInfo = { id: "task1", projectId: "p1", transcriptSessionId: "t1", originalPrompt: "Fix",
  status: "active", currentPhase: "analysis", initialComplexityProfile: "standard", initialComplexityReasons: [],
  initialComplexityConfidence: 0.5, complexityProfile: "standard", complexityReasons: [], complexityConfidence: 0.5,
  complexitySource: "system", complexityAssessmentVersion: "v1", phases: [], createdAt: 1, updatedAt: 1 };

describe("useTranscriptWorkspace", () => {
  const onShowAcp = vi.fn();
  beforeEach(() => { invoke.mockReset(); onShowAcp.mockReset(); });

  it("loads project sessions and indexes Tasks", async () => {
    invoke.mockImplementation((command) => command === "list_transcript_sessions"
      ? Promise.resolve([session("t1")]) : Promise.resolve([task]));
    const { result } = renderHook(() => useTranscriptWorkspace({ projectId: "p1", onShowAcp }));
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    expect(result.current.getTask("t1")).toEqual(task);
  });

  it("publishes a newly created session through state and synchronous identity", async () => {
    invoke.mockImplementation((command) => command === "create_transcript_session"
      ? Promise.resolve(session("t2")) : Promise.resolve([]));
    const { result } = renderHook(() => useTranscriptWorkspace({ projectId: "p1", onShowAcp }));
    await act(() => result.current.create("acp", "Codex", "Codex ACP"));
    expect(result.current.session?.id).toBe("t2"); expect(result.current.getActiveSessionId()).toBe("t2");
    expect(invoke).toHaveBeenCalledWith("create_transcript_session",
      { request: { projectId: "p1", runtime: "acp", source: "Codex", title: "Codex ACP" } });
  });

  it("ignores stale saved-session events after a newer session is opened", async () => {
    let resolveFirst: (value: TranscriptEventInfo[]) => void = () => undefined;
    const first = new Promise<TranscriptEventInfo[]>((resolve) => { resolveFirst = resolve; });
    invoke.mockImplementation((command, args) => command === "list_transcript_events"
      ? args?.sessionId === "t1" ? first : Promise.resolve([{ id: "e2", sessionId: "t2", sequence: 0,
        kind: "assistant_message", content: "new", createdAt: 2 }]) : Promise.resolve([]));
    const { result } = renderHook(() => useTranscriptWorkspace({ projectId: "p1", onShowAcp }));
    act(() => { void result.current.openSaved(session("t1")); });
    await act(() => result.current.openSaved(session("t2")));
    await act(async () => { resolveFirst([{ id: "e1", sessionId: "t1", sequence: 0,
      kind: "assistant_message", content: "old", createdAt: 1 }]); await first; });
    expect(result.current.openedSession?.id).toBe("t2"); expect(result.current.openedEvents[0]?.content).toBe("new");
  });

  it("coalesces and persists non-empty events while updating session metadata", async () => {
    const inserted: TranscriptEventInfo[] = [{ id: "e1", sessionId: "t1", sequence: 0,
      kind: "assistant_message", content: "answer", createdAt: 5 }];
    invoke.mockImplementation((command) => command === "create_transcript_session" ? Promise.resolve(session("t1"))
      : command === "append_transcript_events" ? Promise.resolve(inserted) : Promise.resolve([]));
    const { result } = renderHook(() => useTranscriptWorkspace({ projectId: "p1", onShowAcp }));
    await act(() => result.current.create("acp", "Codex", "Task"));
    await act(() => result.current.record("t1", [{ kind: "agent_message", content: "answer" },
      { kind: "agent_message", content: "" }]));
    expect(result.current.session?.eventCount).toBe(1); expect(result.current.session?.updatedAt).toBe(5);
  });
});
