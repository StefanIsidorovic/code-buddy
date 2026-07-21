import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectInitializationInfo } from "../../types/domain";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
import { useInitializationEvidence } from "./useInitializationEvidence";

const initialization = (id: string, projectId: string, status: ProjectInitializationInfo["status"] = "preflight"):
  ProjectInitializationInfo => ({ id, projectId, status, repositoryCount: 1, createdAt: 1, updatedAt: 1 });

describe("useInitializationEvidence", () => {
  const notifyError = vi.fn();
  beforeEach(() => { invoke.mockReset(); notifyError.mockReset(); });

  it("loads the current initialization and all evidence collections", async () => {
    invoke.mockImplementation((command) => {
      if (command === "list_project_initializations") return Promise.resolve([initialization("i1", "p1")]);
      if (command === "list_project_initialization_summary") return Promise.resolve(null);
      return Promise.resolve([]);
    });
    const { result } = renderHook(() => useInitializationEvidence({ projectId: "p1", notifyError }));
    await waitFor(() => expect(result.current.initialization?.id).toBe("i1"));
    await waitFor(() => expect(result.current.unitsLoading).toBe(false));
    expect(invoke).toHaveBeenCalledWith("list_project_initialization_facts", { initializationId: "i1" });
    expect(invoke).toHaveBeenCalledWith("list_project_initialization_summary", { initializationId: "i1" });
    expect(result.current.facts).toEqual([]); expect(result.current.summary).toBeNull();
  });

  it("ignores an initialization response for a previously selected project", async () => {
    let resolveFirst: (value: ProjectInitializationInfo[]) => void = () => undefined;
    const first = new Promise<ProjectInitializationInfo[]>((resolve) => { resolveFirst = resolve; });
    invoke.mockImplementation((command, args) => command === "list_project_initializations"
      ? args?.projectId === "p1" ? first : Promise.resolve([initialization("i2", "p2")])
      : Promise.resolve(command === "list_project_initialization_summary" ? null : []));
    const { result, rerender } = renderHook(({ projectId }) => useInitializationEvidence({ projectId, notifyError }),
      { initialProps: { projectId: "p1" as string | null } });
    rerender({ projectId: "p2" });
    await waitFor(() => expect(result.current.initialization?.id).toBe("i2"));
    await act(async () => { resolveFirst([initialization("i1", "p1")]); await first; });
    expect(result.current.initialization?.id).toBe("i2");
  });

  it("applies semantic evidence and status updates", async () => {
    invoke.mockImplementation((command) => command === "list_project_initializations"
      ? Promise.resolve([initialization("i1", "p1")])
      : Promise.resolve(command === "list_project_initialization_summary" ? null : []));
    const { result } = renderHook(() => useInitializationEvidence({ projectId: "p1", notifyError }));
    await waitFor(() => expect(result.current.initialization?.id).toBe("i1"));
    act(() => {
      result.current.setFacts("i1", [{ id: "f1", initializationId: "i1", repositoryId: "r1",
        repositoryName: "core", repositoryPath: "/core", kind: "runtime", label: "Language",
        value: "Rust", source: "Cargo.toml", createdAt: 1 }]);
      result.current.advanceStatus(initialization("i1", "p1"), "facts");
    });
    expect(result.current.facts[0]?.label).toBe("Language");
    expect(result.current.initialization?.status).toBe("facts");
  });
});
