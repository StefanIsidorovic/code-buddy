import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GitDeliveryProvenanceHistoryEntry, GitDeliveryReadinessInfo } from "../../types/domain";
import { invokeCommand } from "../../lib/tauriGateway";
import { useDeliveryReadiness } from "./useDeliveryReadiness";

vi.mock("../../lib/tauriGateway", () => ({ invokeCommand: vi.fn() }));
const invoke = vi.mocked(invokeCommand);
const readiness = { repositoryPath: "/repo", worktreeClean: true,
  headProvenance: { present: true } } as GitDeliveryReadinessInfo;
const provenanceHistory: GitDeliveryProvenanceHistoryEntry[] = [
  { commitSha: "abc123full", shortSha: "abc123", subject: "step 28.2",
    hasProvenance: true, planStepId: "28.2", severity: 3, rationale: "Added UI.",
    notePreview: "{\"plan_step_id\":\"28.2\"}" },
];

describe("useDeliveryReadiness", () => {
  it("loads and refreshes the selected repository readiness", async () => {
    invoke.mockResolvedValueOnce(readiness).mockResolvedValueOnce(provenanceHistory)
      .mockResolvedValueOnce(readiness).mockResolvedValueOnce(provenanceHistory);
    const { result } = renderHook(() => useDeliveryReadiness("/repo"));
    await waitFor(() => expect(result.current.readiness).toBe(readiness));
    expect(result.current.provenanceHistory).toBe(provenanceHistory);
    await act(async () => { await result.current.refresh(); });
    expect(invoke).toHaveBeenCalledWith("inspect_git_delivery_readiness", { repositoryPath: "/repo" });
    expect(invoke).toHaveBeenCalledWith("list_git_delivery_provenance_history",
      { repositoryPath: "/repo", limit: 5 });
  });

  it("clears readiness and ignores late responses after repository changes", async () => {
    let resolveOld!: (value: GitDeliveryReadinessInfo) => void;
    let resolveOldHistory!: (value: GitDeliveryProvenanceHistoryEntry[]) => void;
    invoke.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOldHistory = resolve; }))
      .mockResolvedValueOnce({ ...readiness, repositoryPath: "/next" })
      .mockResolvedValueOnce([{ ...provenanceHistory[0], commitSha: "next-full", shortSha: "next" }]);
    const { result, rerender } = renderHook(({ path }) => useDeliveryReadiness(path),
      { initialProps: { path: "/repo" as string | null } });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("inspect_git_delivery_readiness",
      { repositoryPath: "/repo" }));
    rerender({ path: "/next" });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("inspect_git_delivery_readiness",
      { repositoryPath: "/next" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("list_git_delivery_provenance_history",
      { repositoryPath: "/next", limit: 5 }));
    await act(async () => {
      resolveOld(readiness);
      resolveOldHistory(provenanceHistory);
    });
    expect(result.current.readiness?.repositoryPath).toBe("/next");
    expect(result.current.provenanceHistory[0]?.shortSha).toBe("next");
  });

  it("surfaces errors and stays idle without a repository", async () => {
    invoke.mockRejectedValue(new Error("not a git repo"));
    const { result, rerender } = renderHook(({ path }) => useDeliveryReadiness(path),
      { initialProps: { path: "/repo" as string | null } });
    await waitFor(() => expect(result.current.error).toBe("not a git repo"));
    rerender({ path: null });
    await waitFor(() => expect(result.current.readiness).toBeNull());
    expect(result.current.provenanceHistory).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});
