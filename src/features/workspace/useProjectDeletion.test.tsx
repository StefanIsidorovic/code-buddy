import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectInfo } from "../../types/domain";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
import { useProjectDeletion } from "./useProjectDeletion";

const project: ProjectInfo = {
  id: "p1",
  name: "AIadne",
  path: "/repo",
  createdAt: 1,
  updatedAt: 1,
};

function setup(busy = false, stoppedCount = 0) {
  const onBusyChange = vi.fn();
  const stopAcpSessions = vi.fn().mockResolvedValue(stoppedCount);
  const removeFromCatalog = vi.fn();
  const removeEvidence = vi.fn();
  const notifySuccess = vi.fn();
  return {
    onBusyChange,
    stopAcpSessions,
    removeFromCatalog,
    removeEvidence,
    notifySuccess,
    ...renderHook(() => useProjectDeletion({ busy, onBusyChange, stopAcpSessions,
      removeFromCatalog, removeEvidence, notifySuccess })),
  };
}

describe("useProjectDeletion", () => {
  beforeEach(() => invoke.mockReset());

  it("stops ACP sessions, deletes the project, clears local domains, and reports the count", async () => {
    invoke.mockResolvedValue(undefined);
    const value = setup(false, 2);
    act(() => value.result.current.open(project));
    await act(async () => {
      await value.result.current.confirm();
    });
    expect(value.stopAcpSessions).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith("delete_project", { projectId: "p1" });
    expect(value.removeFromCatalog).toHaveBeenCalledWith("p1");
    expect(value.removeEvidence).toHaveBeenCalledWith("p1");
    expect(value.notifySuccess).toHaveBeenCalledWith("AIadne deleted. Stopped 2 ACP sessions.");
    expect(value.onBusyChange.mock.calls).toEqual([[true], [false]]);
    expect(value.result.current.candidate).toBeNull();
  });

  it("keeps the candidate and skips deletion when ACP shutdown fails", async () => {
    invoke.mockResolvedValue(undefined);
    const value = setup();
    value.stopAcpSessions.mockImplementation(() => {
      throw new Error("shutdown failed");
    });
    act(() => value.result.current.open(project));
    await act(async () => {
      await value.result.current.confirm();
    });
    expect(value.result.current.error).toBe("shutdown failed");
    expect(value.result.current.candidate).toEqual(project);
    expect(invoke).not.toHaveBeenCalled();
    expect(value.removeFromCatalog).not.toHaveBeenCalled();
    expect(value.removeEvidence).not.toHaveBeenCalled();
    expect(value.notifySuccess).not.toHaveBeenCalled();
    expect(value.onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it("does not close the confirmation while another action owns the busy lock", () => {
    const value = setup(true);
    act(() => value.result.current.open(project));
    act(() => value.result.current.close());
    expect(value.result.current.candidate).toEqual(project);
  });
});
