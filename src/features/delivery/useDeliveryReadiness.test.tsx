import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GitDeliveryReadinessInfo } from "../../types/domain";
import { invokeCommand } from "../../lib/tauriGateway";
import { useDeliveryReadiness } from "./useDeliveryReadiness";

vi.mock("../../lib/tauriGateway", () => ({ invokeCommand: vi.fn() }));
const invoke = vi.mocked(invokeCommand);
const readiness = { repositoryPath: "/repo", worktreeClean: true,
  headProvenance: { present: true } } as GitDeliveryReadinessInfo;

describe("useDeliveryReadiness", () => {
  it("loads and refreshes the selected repository readiness", async () => {
    invoke.mockResolvedValue(readiness);
    const { result } = renderHook(() => useDeliveryReadiness("/repo"));
    await waitFor(() => expect(result.current.readiness).toBe(readiness));
    await act(async () => { await result.current.refresh(); });
    expect(invoke).toHaveBeenLastCalledWith("inspect_git_delivery_readiness", { repositoryPath: "/repo" });
  });

  it("clears readiness and ignores late responses after repository changes", async () => {
    let resolveOld!: (value: GitDeliveryReadinessInfo) => void;
    invoke.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce({ ...readiness, repositoryPath: "/next" });
    const { result, rerender } = renderHook(({ path }) => useDeliveryReadiness(path),
      { initialProps: { path: "/repo" as string | null } });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("inspect_git_delivery_readiness",
      { repositoryPath: "/repo" }));
    rerender({ path: "/next" });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("inspect_git_delivery_readiness",
      { repositoryPath: "/next" }));
    await act(async () => { resolveOld(readiness); });
    expect(result.current.readiness?.repositoryPath).toBe("/next");
  });

  it("surfaces errors and stays idle without a repository", async () => {
    invoke.mockRejectedValue(new Error("not a git repo"));
    const { result, rerender } = renderHook(({ path }) => useDeliveryReadiness(path),
      { initialProps: { path: "/repo" as string | null } });
    await waitFor(() => expect(result.current.error).toBe("not a git repo"));
    rerender({ path: null });
    await waitFor(() => expect(result.current.readiness).toBeNull());
    expect(result.current.loading).toBe(false);
  });
});
