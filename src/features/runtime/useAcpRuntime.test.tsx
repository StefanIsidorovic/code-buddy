import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AcpRegistryCandidate,
  AcpSessionEvent,
  AcpSessionInfo,
  TaskInfo,
  TranscriptSessionInfo,
  UnifiedTaskContextSelectionInfo,
} from "../../types/domain";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
import { useAcpRuntime } from "./useAcpRuntime";

const candidate: AcpRegistryCandidate = {
  id: "codex-acp",
  name: "Codex",
  version: "1.0.0",
  description: "Codex ACP agent",
  distribution: "binary",
  status: "ready",
  command: ["codex", "acp"],
  runnerPath: "/usr/bin/codex",
  installHint: "",
  sourceUrl: "https://example.test/codex",
};
const session: AcpSessionInfo = {
  id: "acp1",
  state: "running",
  pid: 42,
  cwd: "/repo",
  protocolVersion: 1,
  agentSessionId: "agent1",
  agentName: "Codex",
  agentVersion: "1.0.0",
  exitCode: null,
  codingModel: {
    currentValue: "model-a",
    options: [
      { value: "model-a", name: "Model A", description: null },
      { value: "model-b", name: "Model B", description: null },
    ],
  },
};
const transcriptSession: TranscriptSessionInfo = {
  id: "t1",
  projectId: "p1",
  runtime: "acp",
  source: "Codex",
  title: "Codex ACP",
  startedAt: 1,
  updatedAt: 1,
  eventCount: 0,
};
const task = { id: "task1", projectId: "p1", transcriptSessionId: "t1",
  originalPrompt: "Explain this change", currentPhase: "analysis" } as TaskInfo;
const preview: UnifiedTaskContextSelectionInfo = { initializationId: "init1", characterBudget: 6000,
  usedCharacters: 42, remainingCharacters: 5958,
  renderedContext: "- [task_artifact] Verified evidence",
  included: [{ source: { id: "artifact1", sourceType: "task_artifact", kind: "finding",
    title: "analysis phase", content: "Verified evidence" }, score: 1500,
    reason: "task_phase_artifact", characterCount: 42 }], excluded: [] };

function setup(projectId: string | null = null, activeTask: TaskInfo | null = null) {
  const transcript = {
    create: vi.fn().mockResolvedValue(transcriptSession),
    attachKnowledge: vi.fn().mockResolvedValue(undefined),
    showLive: vi.fn(),
    getActiveId: vi.fn(() => "t1"),
    getTask: vi.fn(() => activeTask),
    upsertTask: vi.fn(),
    record: vi.fn().mockResolvedValue([]),
  };
  const runAction = vi.fn(async (action: () => Promise<void>) => action());
  const reportError = vi.fn();
  return {
    transcript,
    runAction,
    reportError,
    ...renderHook(() =>
      useAcpRuntime({
        projectId,
        cwd: "/repo",
        prompt: "Explain this change",
        onPromptChange: vi.fn(),
        attachedKnowledge: [],
        transcript,
        runAction,
        reportError,
      }),
    ),
  };
}

describe("useAcpRuntime", () => {
  beforeEach(() => invoke.mockReset());

  it("loads the registry, selects its first candidate, and starts a transcript-backed session", async () => {
    invoke.mockImplementation((command) =>
      command === "list_acp_registry_candidates"
        ? Promise.resolve([candidate])
        : command === "start_acp_registry_session"
          ? Promise.resolve(session)
          : Promise.resolve([]),
    );
    const { result, transcript, unmount } = setup();
    await waitFor(() => expect(result.current.selectedCandidateId).toBe(candidate.id));
    await act(() => result.current.startSelected());
    expect(invoke).toHaveBeenCalledWith("start_acp_registry_session", {
      request: { candidateId: candidate.id, cwd: "/repo" },
    });
    expect(transcript.create).toHaveBeenCalledWith("acp", "Codex", "Codex ACP");
    expect(transcript.attachKnowledge).toHaveBeenCalledWith("t1");
    expect(result.current.session?.id).toBe("acp1");
    unmount();
  });

  it("changes the active coding model and sends a recorded prompt", async () => {
    invoke.mockImplementation((command) => {
      if (command === "list_acp_registry_candidates") return Promise.resolve([candidate]);
      if (command === "start_acp_registry_session") return Promise.resolve(session);
      if (command === "set_acp_model") {
        return Promise.resolve({
          ...session,
          codingModel: {
            currentValue: "model-b",
            options: [
              { value: "model-a", name: "Model A", description: null },
              { value: "model-b", name: "Model B", description: null },
            ],
          },
        });
      }
      if (command === "send_task_phase_prompt") return Promise.resolve({
        promptResult: { sessionId: "acp1", stopReason: "end_turn" }, receipt: { id: "run1" },
      });
      return Promise.resolve([]);
    });
    const { result, transcript, unmount } = setup();
    await waitFor(() => expect(result.current.canStartSelected).toBe(true));
    await act(() => result.current.startSelected());
    await act(() => result.current.changeModel("model-b"));
    await act(() => result.current.sendPrompt());
    expect(invoke).toHaveBeenCalledWith("set_acp_model", {
      request: { sessionId: "acp1", modelId: "model-b" },
    });
    expect(invoke).toHaveBeenCalledWith("send_acp_prompt", {
      sessionId: "acp1",
      prompt: "Explain this change",
    });
    expect(transcript.record).toHaveBeenCalledWith("t1", [
      { kind: "user_message", content: "Explain this change" },
    ]);
    unmount();
  });

  it("sends selected context only on the ACP wire while recording the original user prompt", async () => {
    invoke.mockImplementation((command) => {
      if (command === "list_acp_registry_candidates") return Promise.resolve([candidate]);
      if (command === "start_acp_registry_session") return Promise.resolve(session);
      if (command === "send_acp_prompt_with_context") return Promise.resolve({
        promptResult: { sessionId: "acp1", stopReason: "end_turn" },
        receipt: { id: "receipt1", status: "sent" },
      });
      return Promise.resolve([]);
    });
    const { result, transcript, unmount } = setup("p1", task);
    await waitFor(() => expect(result.current.canStartSelected).toBe(true));
    await act(() => result.current.startSelected());
    let sent = false;
    await act(async () => { sent = await result.current.sendPrompt(preview); });
    expect(sent).toBe(true);
    expect(invoke).toHaveBeenCalledWith("send_acp_prompt_with_context", { request: {
      taskId: "task1", transcriptSessionId: "t1", acpSessionId: "acp1",
      userPrompt: "Explain this change", renderedContext: "- [task_artifact] Verified evidence",
      sources: [{ sourceId: "artifact1", sourceType: "task_artifact",
        reason: "task_phase_artifact", score: 1500 }],
    } });
    expect(transcript.record).toHaveBeenCalledWith("t1", [
      { kind: "user_message", content: "Explain this change" },
    ]);
    unmount();
  });

  it("runs one controlled phase instruction without changing the prompt draft", async () => {
    invoke.mockImplementation((command) => {
      if (command === "list_acp_registry_candidates") return Promise.resolve([candidate]);
      if (command === "start_acp_registry_session") return Promise.resolve(session);
      if (command === "send_task_phase_prompt") return Promise.resolve({
        promptResult: { sessionId: "acp1", stopReason: "end_turn" }, receipt: { id: "run1" },
      });
      if (command === "drain_acp_events") return Promise.resolve([{ kind: "agent_message", content: "Analysis result" }]);
      return Promise.resolve([]);
    });
    const { result, transcript, unmount } = setup("p1", task);
    transcript.record.mockImplementation(async (_id, events) => events[0]?.kind === "agent_message"
      ? [{ id: "event1", sessionId: "t1", sequence: 1, kind: "agent_message", content: "Analysis result", createdAt: 2 }]
      : []);
    await waitFor(() => expect(result.current.canStartSelected).toBe(true));
    await act(() => result.current.startSelected());
    await act(() => result.current.sendPhasePrompt("task1", "Run only analysis"));
    expect(invoke).toHaveBeenCalledWith("send_task_phase_prompt", { request: {
      taskId: "task1", transcriptSessionId: "t1", phase: task.currentPhase,
      acpSessionId: "acp1", instruction: "Run only analysis",
    } });
    expect(transcript.record).toHaveBeenCalledWith("t1", [
      { kind: "user_message", content: "Run only analysis" },
    ]);
    expect(invoke).toHaveBeenCalledWith("link_task_phase_run_events", { request: {
      taskId: "task1", receiptId: "run1", transcriptEventIds: ["event1"],
    } });
    expect(result.current.prompt).toBe("Explain this change");
    unmount();
  });

  it("persists live phase output before completion and links the full captured set", async () => {
    let finish: (value: { promptResult: { sessionId: string; stopReason: string };
      receipt: { id: string } }) => void = () => undefined;
    const pending = new Promise<{ promptResult: { sessionId: string; stopReason: string };
      receipt: { id: string } }>((resolve) => { finish = resolve; });
    let phaseStarted = false; let drainCount = 0;
    invoke.mockImplementation((command) => {
      if (command === "list_acp_registry_candidates") return Promise.resolve([candidate]);
      if (command === "start_acp_registry_session") return Promise.resolve(session);
      if (command === "send_task_phase_prompt") { phaseStarted = true; return pending; }
      if (command === "drain_acp_events" && phaseStarted) {
        drainCount += 1; return Promise.resolve(drainCount === 1
          ? [{ kind: "agent_message", content: "Live analysis" }]
          : drainCount === 2 ? [{ kind: "agent_thought", content: "Final check" }] : []);
      }
      return Promise.resolve([]);
    });
    const { result, transcript, unmount } = setup("p1", task); let eventSequence = 0;
    transcript.record.mockImplementation(async (_id, events: AcpSessionEvent[]) => events.map((value) => ({
      id: `event${++eventSequence}`, sessionId: "t1", sequence: eventSequence,
      kind: value.kind, content: value.content, createdAt: 2,
    })));
    await waitFor(() => expect(result.current.canStartSelected).toBe(true));
    await act(() => result.current.startSelected());
    let phaseRun: Promise<boolean>;
    act(() => { phaseRun = result.current.sendPhasePrompt("task1", "Run only analysis"); });
    await waitFor(() => expect(phaseStarted).toBe(true));
    await act(() => result.current.drain());
    expect(result.current.events).toContainEqual({ kind: "agent_message", content: "Live analysis" });
    await act(async () => { finish({ promptResult: { sessionId: "acp1", stopReason: "end_turn" },
      receipt: { id: "run1" } }); await phaseRun; });
    expect(invoke).toHaveBeenCalledWith("link_task_phase_run_events", { request: {
      taskId: "task1", receiptId: "run1", transcriptEventIds: ["event2", "event3"],
    } });
    unmount();
  });

  it("rejects a controlled phase instruction for a different active Task", async () => {
    invoke.mockImplementation((command) => {
      if (command === "list_acp_registry_candidates") return Promise.resolve([candidate]);
      if (command === "start_acp_registry_session") return Promise.resolve(session);
      return Promise.resolve([]);
    });
    const { result, transcript, reportError, unmount } = setup("p1", task);
    await waitFor(() => expect(result.current.canStartSelected).toBe(true));
    await act(() => result.current.startSelected());
    let sent = true;
    await act(async () => { sent = await result.current.sendPhasePrompt("other-task", "Run analysis"); });
    expect(sent).toBe(false);
    expect(invoke.mock.calls.filter(([command]) => command === "send_acp_prompt")).toHaveLength(0);
    expect(transcript.record).not.toHaveBeenCalledWith("t1", expect.anything());
    expect(reportError).toHaveBeenCalledWith("A controlled phase run requires the active Task transcript.");
    unmount();
  });

  it("rejects a second prompt while the first prompt is still in flight", async () => {
    let resolvePrompt: (value: { sessionId: string; stopReason: string }) => void = () => undefined;
    const pending = new Promise<{ sessionId: string; stopReason: string }>((resolve) => { resolvePrompt = resolve; });
    invoke.mockImplementation((command) => {
      if (command === "list_acp_registry_candidates") return Promise.resolve([candidate]);
      if (command === "start_acp_registry_session") return Promise.resolve(session);
      if (command === "send_acp_prompt") return pending;
      return Promise.resolve([]);
    });
    const { result, unmount } = setup();
    await waitFor(() => expect(result.current.canStartSelected).toBe(true));
    await act(() => result.current.startSelected());
    let first: Promise<boolean>; let second = true;
    await act(async () => {
      first = result.current.sendPrompt();
      second = await result.current.sendPrompt();
      resolvePrompt({ sessionId: "acp1", stopReason: "end_turn" });
      await first;
    });
    expect(second).toBe(false);
    expect(invoke.mock.calls.filter(([command]) => command === "send_acp_prompt")).toHaveLength(1);
    unmount();
  });

  it("stops every running ACP session before project deletion", async () => {
    const other = { ...session, id: "acp2" };
    invoke.mockImplementation((command) =>
      command === "list_acp_registry_candidates"
        ? Promise.resolve([candidate])
        : command === "list_acp_sessions"
          ? Promise.resolve([session, other, { ...session, id: "done", state: "exited" }])
          : Promise.resolve({ ...session, state: "exited" }),
    );
    const { result } = setup();
    await waitFor(() => expect(result.current.selectedCandidateId).toBe(candidate.id));
    let stopped = 0;
    await act(async () => {
      stopped = await result.current.stopAllForDelete();
    });
    expect(stopped).toBe(2);
    expect(invoke).toHaveBeenCalledWith("stop_acp_session", { sessionId: "acp1", force: false });
    expect(invoke).toHaveBeenCalledWith("stop_acp_session", { sessionId: "acp2", force: false });
  });
});
