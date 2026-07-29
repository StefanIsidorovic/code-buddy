import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invokeCommand } from "../../lib/tauriGateway";
import type { TaskInfo, TaskPlanStepRunInfo, TaskPlanVersionInfo } from "../../types/domain";
import { useTaskStepExecution } from "./useTaskStepExecution";

vi.mock("../../lib/tauriGateway", () => ({ invokeCommand: vi.fn() }));
const invoke = vi.mocked(invokeCommand);
const task = { id: "task-1", currentPhase: "execution" } as TaskInfo;
const plan = { id: "plan-1", taskId: "task-1", status: "approved", steps: [
  { id: "step-1", orderIndex: 0, title: "Implement", description: "Change",
    kind: "implementation", complexity: 2, acceptanceCriteria: ["Pass"],
    expectedPaths: ["src/a.ts"], satisfies: ["REQ-1"] },
] } as TaskPlanVersionInfo;
const sent = { id: "run-1", taskId: "task-1", planVersionId: "plan-1",
  planStepId: "step-1", status: "sent", scopeStatus: "within_scope",
  verificationStatus: "changed" } as TaskPlanStepRunInfo;
const parallelPlan = { ...plan, steps: [
  { ...plan.steps[0], dependsOn: [] },
  { ...plan.steps[0], id: "step-2", orderIndex: 1, title: "Document",
    expectedPaths: ["docs/a.md"], dependsOn: [] },
] } as TaskPlanVersionInfo;

describe("useTaskStepExecution", () => {
  beforeEach(() => invoke.mockReset());

  it("dispatches the next step and persists explicit review", async () => {
    invoke.mockImplementation((command) => {
      if (!command) return Promise.resolve([]);
      if (command === "list_task_plan_step_runs") return Promise.resolve([]);
      if (command === "send_isolated_task_plan_step_prompt") return Promise.resolve({
        receipt: { ...sent, isolationId: "isolation-1" },
        executorSession: { id: "isolated-acp-1", cwd: "/tmp/isolation-1" },
        promptResult: { stopReason: "end_turn" },
        workspaceVerification: { status: "changed" },
      });
      return Promise.resolve({ ...sent, status: "accepted", reviewStatus: "accepted",
        isolationId: "isolation-1" });
    });
    const { result } = renderHook(() => useTaskStepExecution({
      task, plan, candidateId: "codex", repositoryPath: "/repo",
    }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.dispatch());
    expect(invoke).toHaveBeenCalledWith("send_isolated_task_plan_step_prompt", { request: {
      taskId: "task-1", planVersionId: "plan-1", planStepId: "step-1",
      candidateId: "codex", repositoryPath: "/repo",
    } });
    expect(result.current.runs).toEqual([{ ...sent, isolationId: "isolation-1" }]);
    await act(() => result.current.review("run-1", "accept", "Reviewed Git scope"));
    expect(invoke).toHaveBeenCalledWith("review_task_plan_step_run", { request: {
      taskId: "task-1", runId: "run-1", decision: "accept", note: "Reviewed Git scope",
    } });
    expect(result.current.allAccepted).toBe(false);
  });

  it("ignores a late run list from the previously selected Task", async () => {
    let resolveOld: (value: TaskPlanStepRunInfo[]) => void = () => undefined;
    const old = new Promise<TaskPlanStepRunInfo[]>((resolve) => { resolveOld = resolve; });
    invoke.mockImplementation((_command, args) =>
      args?.taskId === "task-1" ? old : Promise.resolve([]));
    const { result, rerender } = renderHook(({ selected }) => useTaskStepExecution({
      task: selected, plan: null, candidateId: null, repositoryPath: null,
    }), { initialProps: { selected: task } });
    rerender({ selected: { ...task, id: "task-2" } });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("list_task_plan_step_runs", {
      taskId: "task-2",
    }));
    await act(async () => resolveOld([sent]));
    expect(result.current.runs).toEqual([]);
  });

  it("integrates an accepted isolated run and preserves a cleanup warning", async () => {
    const isolated = { ...sent, status: "accepted", reviewStatus: "accepted",
      isolationId: "isolation-1", integrationStatus: null } as TaskPlanStepRunInfo;
    const integrated = { ...isolated, integrationStatus: "integrated",
      isolatedCommitSha: "aaaaaaaa", integratedCommitSha: "bbbbbbbb" } as TaskPlanStepRunInfo;
    invoke.mockImplementation((command) => {
      if (!command) return Promise.resolve([]);
      if (command === "list_task_plan_step_runs") return Promise.resolve([isolated]);
      if (command === "integrate_task_plan_step_run") return Promise.resolve({
        receipt: integrated, cleanupError: "session already stopped",
      });
      return Promise.reject(new Error(`unexpected ${command}`));
    });
    const { result } = renderHook(() => useTaskStepExecution({
      task, plan, candidateId: null, repositoryPath: null,
    }));
    await waitFor(() => expect(result.current.runs).toEqual([isolated]));
    expect(result.current.allAccepted).toBe(false);
    await act(() => result.current.integrate("run-1"));
    expect(invoke).toHaveBeenCalledWith("integrate_task_plan_step_run", {
      request: { taskId: "task-1", runId: "run-1" },
    });
    expect(result.current.runs).toEqual([integrated]);
    expect(result.current.cleanupWarnings).toEqual({
      "run-1": "session already stopped",
    });
    expect(result.current.allAccepted).toBe(true);
  });

  it("refreshes durable conflicted state after integration fails", async () => {
    const isolated = { ...sent, status: "accepted", reviewStatus: "accepted",
      isolationId: "isolation-1", integrationStatus: null } as TaskPlanStepRunInfo;
    const conflicted = { ...isolated, integrationStatus: "conflicted",
      integrationError: "cherry-pick conflict" } as TaskPlanStepRunInfo;
    let lists = 0;
    invoke.mockImplementation((command) => {
      if (!command) return Promise.resolve([]);
      if (command === "list_task_plan_step_runs") {
        lists += 1;
        return Promise.resolve(lists === 1 ? [isolated] : [conflicted]);
      }
      return Promise.reject(new Error("integration failed"));
    });
    const { result } = renderHook(() => useTaskStepExecution({
      task, plan, candidateId: null, repositoryPath: null,
    }));
    await waitFor(() => expect(result.current.runs).toEqual([isolated]));
    await act(() => result.current.integrate("run-1"));
    expect(result.current.runs).toEqual([conflicted]);
    expect(result.current.error).toBe("integration failed");
    expect(result.current.actionRunId).toBeNull();
  });

  it("blocks isolated dispatch until both candidate and registered repository are selected", async () => {
    invoke.mockImplementation((command) => {
      if (!command || command === "list_task_plan_step_runs") return Promise.resolve([]);
      return Promise.reject(new Error(`unexpected ${command}`));
    });
    const { result, rerender } = renderHook(({ candidateId, repositoryPath }) =>
      useTaskStepExecution({ task, plan, candidateId, repositoryPath }), {
      initialProps: { candidateId: null as string | null, repositoryPath: null as string | null },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.runBlockedReason).toMatch(/coding agent/);
    await act(() => result.current.dispatch());
    expect(invoke).not.toHaveBeenCalledWith("send_isolated_task_plan_step_prompt",
      expect.anything());
    rerender({ candidateId: "codex", repositoryPath: null });
    expect(result.current.runBlockedReason).toMatch(/registered project repository/);
    rerender({ candidateId: "codex", repositoryPath: "/repo" });
    expect(result.current.runBlockedReason).toBeNull();
  });

  it("dispatches every current-wave step and preserves partial success", async () => {
    const failed = { ...sent, id: "run-2", planStepId: "step-2", status: "failed",
      error: "worker offline" } as TaskPlanStepRunInfo;
    let lists = 0;
    invoke.mockImplementation((command, args) => {
      if (!command) return Promise.resolve([]);
      if (command === "list_task_plan_step_runs") {
        lists += 1;
        return Promise.resolve(lists === 1 ? [] : [sent, failed]);
      }
      if (command === "send_isolated_task_plan_step_prompt") {
        const request = args?.request;
        const stepId = request && typeof request === "object" && "planStepId" in request
          ? request.planStepId : null;
        if (stepId === "step-2") return Promise.reject(new Error("worker offline"));
        return Promise.resolve({
          receipt: sent, executorSession: {}, promptResult: {}, workspaceVerification: {},
        });
      }
      return Promise.reject(new Error(`unexpected ${command}`));
    });
    const { result } = renderHook(() => useTaskStepExecution({
      task, plan: parallelPlan, candidateId: "codex", repositoryPath: "/repo",
    }));
    await waitFor(() => expect(result.current.waveSteps).toHaveLength(2));
    await act(() => result.current.dispatch());
    expect(invoke).toHaveBeenCalledWith("send_isolated_task_plan_step_prompt", {
      request: expect.objectContaining({ planStepId: "step-1" }),
    });
    expect(invoke).toHaveBeenCalledWith("send_isolated_task_plan_step_prompt", {
      request: expect.objectContaining({ planStepId: "step-2" }),
    });
    expect(result.current.runs).toEqual([sent, failed]);
    expect(result.current.error).toContain("Step 2: worker offline");
    expect(result.current.currentWave?.number).toBe(1);
  });

  it("automatically evaluates a settled wave with exact Task and repository identity", async () => {
    const report = { id: "report-1", taskId: "task-1", phase: "execution", sequence: 1,
      role: "reviewer", transcriptSessionId: "transcript-1", content: "PASS run-1",
      sourceTranscriptEventIds: ["event-1"], createdAt: 1 };
    invoke.mockImplementation((command) => {
      if (!command) return Promise.resolve([]);
      if (command === "list_task_plan_step_runs") return Promise.resolve([]);
      if (command === "send_isolated_task_plan_step_prompt") return Promise.resolve({
        receipt: sent, executorSession: {}, promptResult: {}, workspaceVerification: {},
      });
      if (command === "run_task_wave_evaluation") return Promise.resolve({
        promptResult: {}, transcriptSession: {}, report,
      });
      return Promise.reject(new Error(`unexpected ${command}`));
    });
    const { result } = renderHook(() => useTaskStepExecution({
      task, plan, candidateId: "codex", repositoryPath: "/repo",
    }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.dispatch());
    expect(invoke).toHaveBeenCalledWith("run_task_wave_evaluation", { request: {
      taskId: "task-1", planVersionId: "plan-1", candidateId: "codex", cwd: "/repo",
    } });
    expect(result.current.waveEvaluation).toEqual({
      status: "ready", waveNumber: 1, report, error: null,
    });
  });

  it("preserves worker results when evaluation is unavailable and allows retry", async () => {
    let evaluations = 0;
    invoke.mockImplementation((command) => {
      if (!command) return Promise.resolve([]);
      if (command === "list_task_plan_step_runs") return Promise.resolve([]);
      if (command === "send_isolated_task_plan_step_prompt") return Promise.resolve({
        receipt: sent, executorSession: {}, promptResult: {}, workspaceVerification: {},
      });
      if (command === "run_task_wave_evaluation") {
        evaluations += 1;
        if (evaluations === 1) return Promise.reject(new Error("reviewer offline"));
        return Promise.resolve({ promptResult: {}, transcriptSession: {}, report: {
          id: "report-2", content: "NEEDS_ATTENTION run-1",
        } });
      }
      return Promise.reject(new Error(`unexpected ${command}`));
    });
    const { result } = renderHook(() => useTaskStepExecution({
      task, plan, candidateId: "codex", repositoryPath: "/repo",
    }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.dispatch());
    expect(result.current.runs).toEqual([sent]);
    expect(result.current.waveEvaluation).toEqual({
      status: "unavailable", waveNumber: 1, report: null, error: "reviewer offline",
    });
    await act(() => result.current.retryWaveEvaluation());
    expect(result.current.waveEvaluation?.status).toBe("ready");
  });

  it("ignores an evaluator result that arrives after the selected Task changes", async () => {
    let resolveEvaluation!: (value: unknown) => void;
    const pendingEvaluation = new Promise((resolve) => { resolveEvaluation = resolve; });
    invoke.mockImplementation((command) => {
      if (!command || command === "list_task_plan_step_runs") return Promise.resolve([]);
      if (command === "send_isolated_task_plan_step_prompt") return Promise.resolve({
        receipt: sent, executorSession: {}, promptResult: {}, workspaceVerification: {},
      });
      if (command === "run_task_wave_evaluation") return pendingEvaluation;
      return Promise.reject(new Error(`unexpected ${command}`));
    });
    const secondTask = { ...task, id: "task-2" };
    const secondPlan = { ...plan, id: "plan-2", taskId: "task-2" };
    const { result, rerender } = renderHook(({ selectedTask, selectedPlan }) =>
      useTaskStepExecution({
        task: selectedTask, plan: selectedPlan, candidateId: "codex", repositoryPath: "/repo",
      }), { initialProps: { selectedTask: task, selectedPlan: plan } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    let dispatch!: Promise<void>;
    act(() => { dispatch = result.current.dispatch(); });
    await waitFor(() => expect(result.current.waveEvaluation?.status).toBe("running"));
    rerender({ selectedTask: secondTask, selectedPlan: secondPlan });
    await act(async () => resolveEvaluation({
      promptResult: {}, transcriptSession: {}, report: { id: "stale-report" },
    }));
    await act(() => dispatch);
    expect(result.current.waveEvaluation).toBeNull();
  });
});
