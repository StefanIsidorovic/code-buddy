import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskAgentReportInfo, TaskInfo } from "../../types/domain";
import { invokeCommand } from "../../lib/tauriGateway";
import { useTaskAgentReports } from "./useTaskAgentReports";

vi.mock("../../lib/tauriGateway", () => ({ invokeCommand: vi.fn() }));
const invoke = vi.mocked(invokeCommand);
const task = { id: "task-1" } as TaskInfo;
const activeTask = { id: "task-1", status: "in_progress", currentPhase: "analysis",
  phases: [{ phase: "analysis", status: "in_progress" }] } as TaskInfo;
const report = { id: "report-1" } as TaskAgentReportInfo;

describe("useTaskAgentReports", () => {
  it("loads and refreshes the active Task reports", async () => {
    invoke.mockResolvedValue([report]);
    const { result } = renderHook(() => useTaskAgentReports(task));
    await waitFor(() => expect(result.current.reports).toEqual([report]));
    await act(async () => { await result.current.refresh(); });
    expect(invoke).toHaveBeenLastCalledWith("list_task_agent_reports", { taskId: "task-1" });
  });

  it("clears old reports and ignores a late response after the Task changes", async () => {
    let resolveOld!: (value: TaskAgentReportInfo[]) => void;
    invoke.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce([]);
    const { result, rerender } = renderHook(({ value }) => useTaskAgentReports(value),
      { initialProps: { value: task as TaskInfo | null } });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("list_task_agent_reports", { taskId: "task-1" }));
    rerender({ value: { id: "task-2" } as TaskInfo });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("list_task_agent_reports", { taskId: "task-2" }));
    await act(async () => { resolveOld([report]); });
    expect(result.current.reports).toEqual([]);
  });

  it("surfaces active-request errors", async () => {
    invoke.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useTaskAgentReports(task));
    await waitFor(() => expect(result.current.error).toBe("offline"));
  });

  it("runs a secondary advisor report and refreshes the active Task", async () => {
    invoke.mockImplementation((command) => command === "list_task_agent_reports"
      ? Promise.resolve([])
      : Promise.resolve({ report }));
    const { result } = renderHook(() => useTaskAgentReports(activeTask,
      { candidateId: "codex-acp", cwd: "/repo" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("list_task_agent_reports", { taskId: "task-1" }));
    await act(async () => { await result.current.run("advisor"); });
    expect(invoke).toHaveBeenCalledWith("run_task_agent_report", { request: { taskId: "task-1",
      phase: "analysis", role: "advisor", candidateId: "codex-acp", cwd: "/repo" } });
    expect(invoke).toHaveBeenLastCalledWith("list_task_agent_reports", { taskId: "task-1" });
    expect(result.current.runningRole).toBeNull();
  });

  it("does not attach a late run result after the Task changes", async () => {
    let resolveRun!: (value: unknown) => void;
    invoke.mockImplementation((command) => {
      if (command === "run_task_agent_report") return new Promise((resolve) => { resolveRun = resolve; });
      return Promise.resolve([]);
    });
    const { result, rerender } = renderHook(({ value }) => useTaskAgentReports(value,
      { candidateId: "codex-acp", cwd: "/repo" }), { initialProps: { value: activeTask as TaskInfo | null } });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("list_task_agent_reports", { taskId: "task-1" }));
    let run!: Promise<void>;
    act(() => { run = result.current.run("advisor"); });
    await waitFor(() => expect(result.current.runningRole).toBe("advisor"));
    rerender({ value: { ...activeTask, id: "task-2" } as TaskInfo });
    await waitFor(() => expect(result.current.runningRole).toBeNull());
    await act(async () => { resolveRun({ report }); await run; });
    expect(result.current.reports).toEqual([]);
  });
});
