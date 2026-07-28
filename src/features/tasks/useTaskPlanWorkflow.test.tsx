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
    await act(() => result.current.approve("plan-1"));
    expect(result.current.approved?.id).toBe("plan-1");
    expect(invoke).toHaveBeenCalledWith("approve_task_plan_version", {
      request: { taskId: "task-1", planVersionId: "plan-1" },
    });
  });
});
