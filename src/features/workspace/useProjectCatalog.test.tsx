import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectInfo, ProjectRepositoryInfo } from "../../types/domain";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), open: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mocks.open }));
import { useProjectCatalog } from "./useProjectCatalog";

const project = (id: string, name = id): ProjectInfo => ({ id, name, path: `/${id}`, createdAt: 1, updatedAt: 1 });
const repository = (id: string, projectId: string): ProjectRepositoryInfo => ({ id, projectId, name: id,
  path: `/${projectId}/${id}`, isDefault: false, createdAt: 1, updatedAt: 1 });

describe("useProjectCatalog", () => {
  const notify = vi.fn(); const onBusyChange = vi.fn();
  beforeEach(() => { mocks.invoke.mockReset(); mocks.open.mockReset(); notify.mockReset(); onBusyChange.mockReset(); });

  it("loads projects and repositories and selects their first entries", async () => {
    mocks.invoke.mockImplementation((command) => command === "list_projects"
      ? Promise.resolve([project("p1")]) : Promise.resolve([repository("r1", "p1")]));
    const { result } = renderHook(() => useProjectCatalog({ notify, onBusyChange }));
    await waitFor(() => expect(result.current.selectedProject?.id).toBe("p1"));
    await waitFor(() => expect(result.current.selectedRepository?.id).toBe("r1"));
    expect(mocks.invoke).toHaveBeenCalledWith("list_project_repositories", { projectId: "p1" });
  });

  it("creates a project and exposes semantic dialog/form actions", async () => {
    mocks.invoke.mockImplementation((command) => command === "list_projects" ? Promise.resolve([])
      : command === "create_project" ? Promise.resolve(project("p2", "New")) : Promise.resolve([]));
    const { result } = renderHook(() => useProjectCatalog({ notify, onBusyChange }));
    act(() => { result.current.openWorkspaceDialog(); result.current.changeProjectName("New");
      result.current.changeProjectPath("/p2"); });
    await act(() => result.current.createProject());
    expect(result.current.selectedProject?.id).toBe("p2");
    expect(result.current.projectName).toBe("");
    expect(notify).toHaveBeenCalledWith("success", "New added.");
    expect(onBusyChange.mock.calls).toEqual([[true], [false]]);
  });

  it("fills project form from the native folder picker", async () => {
    mocks.invoke.mockResolvedValue([]); mocks.open.mockResolvedValue("/work/AIadne");
    const { result } = renderHook(() => useProjectCatalog({ notify, onBusyChange }));
    await act(() => result.current.chooseProjectFolder());
    expect(result.current.projectPath).toBe("/work/AIadne");
    expect(result.current.projectName).toBe("AIadne");
  });

  it("ignores a stale repository response after project selection changes", async () => {
    let resolveFirst: (value: ProjectRepositoryInfo[]) => void = () => undefined;
    const first = new Promise<ProjectRepositoryInfo[]>((resolve) => { resolveFirst = resolve; });
    mocks.invoke.mockImplementation((command, args) => {
      if (command === "list_projects") return Promise.resolve([project("p1"), project("p2")]);
      return args?.projectId === "p1" ? first : Promise.resolve([repository("r2", "p2")]);
    });
    const { result } = renderHook(() => useProjectCatalog({ notify, onBusyChange }));
    await waitFor(() => expect(result.current.selectedProject?.id).toBe("p1"));
    act(() => result.current.selectProject("p2"));
    await waitFor(() => expect(result.current.selectedRepository?.id).toBe("r2"));
    await act(async () => { resolveFirst([repository("r1", "p1")]); await first; });
    expect(result.current.selectedRepository?.id).toBe("r2");
  });
});
