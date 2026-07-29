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

describe("useTaskStepExecution", () => {
  beforeEach(() => invoke.mockReset());

  it("dispatches the next step and persists explicit review", async () => {
    invoke.mockImplementation((command) => {
      if (command === "list_task_plan_step_runs") return Promise.resolve([]);
      if (command === "send_task_plan_step_prompt") return Promise.resolve({
        receipt: sent, promptResult: { stopReason: "end_turn" },
        workspaceVerification: { status: "changed" },
      });
      return Promise.resolve({ ...sent, status: "accepted", reviewStatus: "accepted" });
    });
    const settled = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTaskStepExecution({
      task, plan, acpSessionId: "acp-1", onDispatchSettled: settled,
    }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.dispatch());
    expect(invoke).toHaveBeenCalledWith("send_task_plan_step_prompt", { request: {
      taskId: "task-1", planVersionId: "plan-1", planStepId: "step-1", acpSessionId: "acp-1",
    } });
    expect(result.current.runs).toEqual([sent]);
    expect(settled).toHaveBeenCalledOnce();
    await act(() => result.current.review("run-1", "accept", "Reviewed Git scope"));
    expect(invoke).toHaveBeenCalledWith("review_task_plan_step_run", { request: {
      taskId: "task-1", runId: "run-1", decision: "accept", note: "Reviewed Git scope",
    } });
    expect(result.current.allAccepted).toBe(true);
  });

  it("ignores a late run list from the previously selected Task", async () => {
    let resolveOld: (value: TaskPlanStepRunInfo[]) => void = () => undefined;
    const old = new Promise<TaskPlanStepRunInfo[]>((resolve) => { resolveOld = resolve; });
    invoke.mockImplementation((_command, args) =>
      args?.taskId === "task-1" ? old : Promise.resolve([]));
    const { result, rerender } = renderHook(({ selected }) => useTaskStepExecution({
      task: selected, plan: null, acpSessionId: null, onDispatchSettled: vi.fn(),
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
      task, plan, acpSessionId: null, onDispatchSettled: vi.fn(),
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
      task, plan, acpSessionId: null, onDispatchSettled: vi.fn(),
    }));
    await waitFor(() => expect(result.current.runs).toEqual([isolated]));
    await act(() => result.current.integrate("run-1"));
    expect(result.current.runs).toEqual([conflicted]);
    expect(result.current.error).toBe("integration failed");
    expect(result.current.actionRunId).toBeNull();
  });
});
