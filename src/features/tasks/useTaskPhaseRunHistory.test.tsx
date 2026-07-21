import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskInfo, TaskPhaseRunReceiptInfo } from "../../types/domain";
const invoke = vi.hoisted(() => vi.fn()); vi.mock("@tauri-apps/api/core", () => ({ invoke }));
import { useTaskPhaseRunHistory } from "./useTaskPhaseRunHistory";
const task = { id: "t1" } as TaskInfo;
const pending = { id: "r1", taskId: "t1", status: "pending" } as TaskPhaseRunReceiptInfo;
const failed = { ...pending, status: "failed", error: "manually resolved" } as TaskPhaseRunReceiptInfo;
describe("useTaskPhaseRunHistory", () => {
  beforeEach(() => invoke.mockReset());
  it("loads runs and resolves pending with the exact payload", async () => {
    invoke.mockImplementation((command) => command === "list_task_phase_run_receipts" ? Promise.resolve([pending]) : Promise.resolve(failed));
    const { result } = renderHook(() => useTaskPhaseRunHistory(task));
    await waitFor(() => expect(result.current.receipts).toEqual([pending]));
    act(() => { result.current.openResolution("r1"); result.current.changeResolutionReason("No result after restart"); });
    await act(() => result.current.resolve());
    expect(invoke).toHaveBeenCalledWith("resolve_pending_task_phase_run", { request: {
      taskId: "t1", receiptId: "r1", reason: "No result after restart" } });
    expect(result.current.receipts).toEqual([failed]);
  });
  it("ignores a stale load after Task change", async () => {
    let finish: (value: TaskPhaseRunReceiptInfo[]) => void = () => undefined;
    const load = new Promise<TaskPhaseRunReceiptInfo[]>((resolve) => { finish = resolve; });
    invoke.mockImplementation((command, args) => command === "list_task_phase_run_receipts" && args?.taskId === "t1" ? load : Promise.resolve([]));
    const { result, rerender } = renderHook(({ value }) => useTaskPhaseRunHistory(value), { initialProps: { value: task } });
    rerender({ value: { ...task, id: "t2" } }); await act(async () => { finish([pending]); await load; });
    expect(result.current.receipts).toEqual([]);
  });
});
