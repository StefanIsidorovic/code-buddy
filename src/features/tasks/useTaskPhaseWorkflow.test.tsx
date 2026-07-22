import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskInfo, TaskPhaseArtifactInfo, TranscriptEventInfo } from "../../types/domain";
const invoke = vi.hoisted(() => vi.fn()); vi.mock("@tauri-apps/api/core", () => ({ invoke }));
import { useTaskPhaseWorkflow } from "./useTaskPhaseWorkflow";

const phase = { id: "p1", taskId: "t1", phase: "analysis" as const, phaseIndex: 0,
  status: "in_progress", startedAt: 1, completedAt: null };
const task: TaskInfo = { id: "t1", projectId: "project", transcriptSessionId: "s1", originalPrompt: "Fix",
  status: "in_progress", currentPhase: "analysis", initialComplexityProfile: "standard",
  initialComplexityReasons: [], initialComplexityConfidence: 50, complexityProfile: "standard",
  complexityReasons: [], complexityConfidence: 50, complexitySource: "system",
  complexityAssessmentVersion: "v1", phases: [phase], createdAt: 1, updatedAt: 1 };
const source: TranscriptEventInfo = { id: "e1", sessionId: "s1", sequence: 0, kind: "agent_message",
  content: "Evidence", createdAt: 1 };
const artifact: TaskPhaseArtifactInfo = { id: "a1", taskId: "t1", phase: "analysis", sequence: 0,
  kind: "summary", content: "Result", sourceTranscriptEventIds: ["e1"], createdAt: 1 };

describe("useTaskPhaseWorkflow", () => {
  beforeEach(() => invoke.mockReset());
  it("loads artifacts and sends exact transition payloads", async () => {
    invoke.mockImplementation((command) => command === "list_task_phase_artifacts" ? Promise.resolve([artifact])
      : Promise.resolve(task)); const upsertTask = vi.fn();
    const { result } = renderHook(() => useTaskPhaseWorkflow({ task, sourceEvents: [source], upsertTask }));
    await waitFor(() => expect(result.current.artifacts).toEqual([artifact]));
    await act(() => result.current.start()); act(() => result.current.acknowledgeEvidenceReview(true));
    await act(() => result.current.complete());
    expect(invoke).toHaveBeenCalledWith("transition_task_phase", { request: { taskId: "t1", action: "start" } });
    expect(invoke).toHaveBeenCalledWith("transition_task_phase", { request: { taskId: "t1", action: "complete" } });
    expect(upsertTask).toHaveBeenCalledTimes(2);
  });
  it("creates an artifact from selected persisted events and resets the draft", async () => {
    invoke.mockImplementation((command) => command === "list_task_phase_artifacts" ? Promise.resolve([])
      : Promise.resolve(artifact)); const { result } = renderHook(() => useTaskPhaseWorkflow({ task,
        sourceEvents: [source], upsertTask: vi.fn() })); await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.changeKind("risk"); result.current.changeContent("Result");
      result.current.toggleSource("e1", true); }); await act(() => result.current.createArtifact());
    expect(invoke).toHaveBeenCalledWith("create_task_phase_artifact", { request: { taskId: "t1",
      phase: "analysis", kind: "risk", content: "Result", sourceTranscriptEventIds: ["e1"] } });
    expect(result.current.artifacts).toEqual([artifact]); expect(result.current.content).toBe("");
    expect(result.current.sourceIds).toEqual([]);
  });
  it("ignores a transition result after the active Task changes", async () => {
    let resolveTransition: (value: TaskInfo) => void = () => undefined;
    const transition = new Promise<TaskInfo>((resolve) => { resolveTransition = resolve; });
    invoke.mockImplementation((command) => command === "list_task_phase_artifacts" ? Promise.resolve([]) : transition);
    const upsertTask = vi.fn(); const nextTask = { ...task, id: "t2", transcriptSessionId: "s2" };
    const { result, rerender } = renderHook(({ value }) => useTaskPhaseWorkflow({ task: value,
      sourceEvents: [source], upsertTask }), { initialProps: { value: task } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { void result.current.start(); }); rerender({ value: nextTask });
    await act(async () => { resolveTransition(task); await transition; });
    expect(upsertTask).not.toHaveBeenCalled();
  });
  it("prepares editable evidence from exact linked phase-run events", async () => {
    const thought = { ...source, id: "e3", sequence: 2, kind: "agent_thought", content: "Risk check" };
    invoke.mockImplementation((command) => command === "latest_task_phase_run_response_events"
      ? Promise.resolve([source, thought]) : Promise.resolve([]));
    const { result } = renderHook(() => useTaskPhaseWorkflow({ task, sourceEvents: [source, thought], upsertTask: vi.fn() }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.prepareCompletion());
    expect(invoke).toHaveBeenCalledWith("latest_task_phase_run_response_events", { taskId: "t1" });
    expect(result.current.sourceIds).toEqual(["e1", "e3"]);
    expect(result.current.content).toBe("Evidence\n\nRisk check");
  });
  it("explains when no linked phase response can prepare completion", async () => {
    invoke.mockResolvedValue([]); const { result } = renderHook(() => useTaskPhaseWorkflow({ task,
      sourceEvents: [], upsertTask: vi.fn() })); await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.prepareCompletion());
    expect(result.current.error).toMatch(/Run the current phase first/);
  });
  it("ignores prepared response after the active Task changes", async () => {
    let finish: (events: TranscriptEventInfo[]) => void = () => undefined;
    const response = new Promise<TranscriptEventInfo[]>((resolve) => { finish = resolve; });
    invoke.mockImplementation((command) => command === "latest_task_phase_run_response_events"
      ? response : Promise.resolve([])); const nextTask = { ...task, id: "t2", transcriptSessionId: "s2" };
    const { result, rerender } = renderHook(({ value }) => useTaskPhaseWorkflow({ task: value,
      sourceEvents: [source], upsertTask: vi.fn() }), { initialProps: { value: task } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { void result.current.prepareCompletion(); }); rerender({ value: nextTask });
    await act(async () => { finish([source]); await response; });
    expect(result.current.content).toBe(""); expect(result.current.sourceIds).toEqual([]);
  });
  it("blocks completion until evidence review is acknowledged and resets it after artifact change", async () => {
    invoke.mockImplementation((command) => command === "list_task_phase_artifacts" ? Promise.resolve([artifact])
      : command === "create_task_phase_artifact" ? Promise.resolve(artifact) : Promise.resolve(task));
    const { result } = renderHook(() => useTaskPhaseWorkflow({ task, sourceEvents: [source], upsertTask: vi.fn() }));
    await waitFor(() => expect(result.current.artifacts).toEqual([artifact]));
    await act(() => result.current.complete());
    expect(invoke.mock.calls.filter(([command]) => command === "transition_task_phase")).toHaveLength(0);
    act(() => result.current.acknowledgeEvidenceReview(true)); expect(result.current.evidenceReviewed).toBe(true);
    act(() => { result.current.changeContent("New evidence"); result.current.toggleSource("e1", true); });
    await act(() => result.current.createArtifact()); expect(result.current.evidenceReviewed).toBe(false);
  });
});
