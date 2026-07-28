import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invokeCommand } from "../../lib/tauriGateway";
import type { TaskInfo, TaskPlanVersionInfo } from "../../types/domain";
import { useTaskPlanWorkflow } from "./useTaskPlanWorkflow";

vi.mock("../../lib/tauriGateway", () => ({ invokeCommand: vi.fn() }));
const invoke = vi.mocked(invokeCommand);
const task = { id: "task-1" } as TaskInfo;
const version = { id: "plan-1", status: "draft" } as TaskPlanVersionInfo;

describe("useTaskPlanWorkflow", () => {
  beforeEach(() => invoke.mockReset());

  it("loads, creates and approves immutable plan versions", async () => {
    invoke.mockImplementation((command) => {
      if (command === "list_task_plan_versions") return Promise.resolve([]);
      if (command === "create_task_plan_version") return Promise.resolve(version);
      if (command === "evaluate_task_plan") return Promise.resolve({
        id: "evaluation-1", taskId: "task-1", planVersionId: "plan-1", planVersion: 1,
        verdict: "clean", findings: [], createdAt: 2,
      });
      return Promise.resolve({ ...version, status: "approved", approvedAt: 2 });
    });
    const { result } = renderHook(() => useTaskPlanWorkflow(task));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("list_task_plan_versions", {
      taskId: "task-1",
    }));
    await act(() => result.current.create("artifact-1", {
      requirements: [{ id: "REQ-1", text: "Works", kind: "functional" }],
      steps: [{ title: "Implement", description: "Change code", kind: "implementation",
        complexity: 2, acceptanceCriteria: ["Pass"], expectedPaths: [], satisfies: ["REQ-1"] }],
    }));
    expect(result.current.versions).toEqual([version]);
    await act(() => result.current.evaluate("plan-1"));
    expect(result.current.evaluation?.verdict).toBe("clean");
    await act(() => result.current.approve("plan-1"));
    expect(result.current.approved?.id).toBe("plan-1");
    expect(invoke).toHaveBeenCalledWith("approve_task_plan_version", {
      request: { taskId: "task-1", planVersionId: "plan-1" },
    });
  });

  it("runs grounded critique with the selected isolated agent context", async () => {
    const evaluation = {
      id: "evaluation-1", taskId: "task-1", planVersionId: "plan-1", planVersion: 1,
      verdict: "flags", findings: [{ id: "MISSING_PATHS:step-1", code: "MISSING_PATHS",
        severity: "warning", message: "Missing paths", requirementId: null, stepIds: ["step-1"] }],
      createdAt: 2,
    };
    invoke.mockImplementation((command) => {
      if (command === "list_task_plan_versions") return Promise.resolve([version]);
      if (command === "get_task_plan_evaluation") return Promise.resolve(evaluation);
      if (command === "get_task_plan_critique") return Promise.resolve(null);
      if (command === "run_task_plan_critique") return Promise.resolve({
        cached: false, promptResult: null,
        critique: { id: "critique-1", taskId: "task-1", planVersionId: "plan-1",
          evaluationId: "evaluation-1", source: "codex-acp", createdAt: 3,
          issues: [{ findingIds: ["MISSING_PATHS:step-1"], explanation: "Scope is unclear",
            proposedRepair: "Declare expected paths", repairs: [{
              kind: "set_step_expected_paths", stepId: "step-1", expectedPaths: ["src/**"],
            }] }] },
      });
      if (command === "apply_task_plan_critique") return Promise.resolve({
        ...version, id: "plan-2", version: 2,
      });
      return Promise.resolve(null);
    });
    const { result } = renderHook(() => useTaskPlanWorkflow(task, {
      candidateId: "codex-acp", cwd: "/repo",
    }));
    await waitFor(() => expect(result.current.evaluation?.id).toBe("evaluation-1"));
    await act(() => result.current.runCritique());
    expect(result.current.critique?.id).toBe("critique-1");
    expect(invoke).toHaveBeenCalledWith("run_task_plan_critique", { request: {
      taskId: "task-1", planVersionId: "plan-1", evaluationId: "evaluation-1",
      candidateId: "codex-acp", cwd: "/repo",
    } });
    await act(() => result.current.applyRepairs());
    expect(result.current.versions[result.current.versions.length - 1]?.id).toBe("plan-2");
    expect(result.current.evaluation).toBeNull();
    expect(result.current.critique).toBeNull();
    expect(invoke).toHaveBeenCalledWith("apply_task_plan_critique", {
      request: { taskId: "task-1", critiqueId: "critique-1" },
    });
  });
});
