import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectInfo, ProjectRepositoryInfo } from "../../types/domain";
import { WorkspaceContextSelector, WorkspaceContextSummary } from "./WorkspaceContextSelector";

const project: ProjectInfo = {
  id: "project-1", name: "AIadne", path: "/work/AIadne", createdAt: 1, updatedAt: 2,
};
const repository: ProjectRepositoryInfo = {
  id: "repo-1", projectId: project.id, name: "desktop", path: "/work/AIadne/desktop",
  isDefault: true, createdAt: 1, updatedAt: 2,
};

describe("workspace context selector", () => {
  function renderContext(selectedProject: ProjectInfo | null, selectedRepository: ProjectRepositoryInfo | null,
    onOpenWorkspace = vi.fn(), onOpenRepository = vi.fn()) {
    render(<><WorkspaceContextSummary project={selectedProject} repository={selectedRepository} />
      <WorkspaceContextSelector project={selectedProject} repository={selectedRepository}
        onOpenWorkspace={onOpenWorkspace} onOpenRepository={onOpenRepository} /></>);
  }

  it("renders empty context and blocks repository management", () => {
    renderContext(null, null);
    expect(screen.getAllByText("No workspace")).toHaveLength(2);
    expect(screen.getByText("No repository")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Current repository/ })).toBeDisabled();
  });

  it("shows the default repository summary before explicit selection", () => {
    renderContext(project, null);
    expect(screen.getByText("Default repository")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Current repository/ })).toBeEnabled();
  });

  it("renders selected paths and forwards both picker actions", () => {
    const onOpenWorkspace = vi.fn();
    const onOpenRepository = vi.fn();
    renderContext(project, repository, onOpenWorkspace, onOpenRepository);
    expect(screen.getByText(repository.path)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Current workspace/ }));
    fireEvent.click(screen.getByRole("button", { name: /Current repository/ }));
    expect(onOpenWorkspace).toHaveBeenCalledOnce();
    expect(onOpenRepository).toHaveBeenCalledOnce();
  });
});
