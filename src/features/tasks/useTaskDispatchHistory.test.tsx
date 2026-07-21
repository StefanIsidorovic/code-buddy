import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskContextDispatchReceiptInfo, TaskInfo } from "../../types/domain";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
import { useTaskDispatchHistory } from "./useTaskDispatchHistory";

const task = { id: "t1" } as TaskInfo;
const pending = { id: "r1", taskId: "t1", status: "pending" } as TaskContextDispatchReceiptInfo;
const failed = { ...pending, status: "failed", error: "manually resolved" } as TaskContextDispatchReceiptInfo;

describe("useTaskDispatchHistory", () => {
  beforeEach(() => invoke.mockReset());
  it("loads receipts and sends an exact manual resolution payload", async () => {
    invoke.mockImplementation((command) => command === "list_task_context_dispatch_receipts"
      ? Promise.resolve([pending]) : Promise.resolve(failed));
    const { result } = renderHook(() => useTaskDispatchHistory(task));
    await waitFor(() => expect(result.current.receipts).toEqual([pending]));
    act(() => { result.current.openResolution("r1");
      result.current.changeResolutionReason("No result after restart"); });
    await act(() => result.current.resolve());
    expect(invoke).toHaveBeenCalledWith("resolve_pending_task_context_dispatch", { request: {
      taskId: "t1", receiptId: "r1", reason: "No result after restart" } });
    expect(result.current.receipts).toEqual([failed]);
    expect(result.current.resolutionReceiptId).toBeNull();
  });
  it("ignores a receipt load after the active Task changes", async () => {
    let resolveLoad: (value: TaskContextDispatchReceiptInfo[]) => void = () => undefined;
    const load = new Promise<TaskContextDispatchReceiptInfo[]>((resolve) => { resolveLoad = resolve; });
    invoke.mockImplementation((command, args) => command === "list_task_context_dispatch_receipts"
      && args?.taskId === "t1" ? load : Promise.resolve([]));
    const { result, rerender } = renderHook(({ value }) => useTaskDispatchHistory(value),
      { initialProps: { value: task } });
    rerender({ value: { ...task, id: "t2" } });
    await act(async () => { resolveLoad([pending]); await load; });
    expect(result.current.receipts).toEqual([]);
  });
});
