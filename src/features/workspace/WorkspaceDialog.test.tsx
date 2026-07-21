import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectInfo } from "../../types/domain";
import { WorkspaceDialog, type WorkspaceDialogProps } from "./WorkspaceDialog";

const projects: ProjectInfo[] = [
  { id: "p1", name: "AIadne", path: "/work/aiadne", createdAt: 1, updatedAt: 1 },
  { id: "p2", name: "Buddy", path: "/work/buddy", createdAt: 1, updatedAt: 1 },
];

function props(overrides: Partial<WorkspaceDialogProps> = {}): WorkspaceDialogProps {
  return {
    busy: false, folderPicking: false, loading: false, name: "", path: "", projects: [],
    selectedProjectId: null, sessionLocked: false, onAdd: vi.fn(), onChangeName: vi.fn(),
    onChangePath: vi.fn(), onChooseFolder: vi.fn(), onClose: vi.fn(), onDelete: vi.fn(),
    onRefresh: vi.fn(), onSelect: vi.fn(), ...overrides,
  };
}

describe("workspace dialog", () => {
  it("renders the empty state and refreshes", () => {
    const value = props({ name: "AIadne", path: "/work/aiadne" });
    const { rerender } = render(<WorkspaceDialog {...value} />);
    expect(screen.getByText("No workspaces yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(value.onRefresh).toHaveBeenCalledOnce();
    rerender(<WorkspaceDialog {...value} loading />);
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add Project" })).toBeEnabled();
  });

  it("renders the selected workspace and locks row actions during a session", () => {
    render(<WorkspaceDialog {...props({ projects, selectedProjectId: "p1", sessionLocked: true })} />);
    expect(screen.getByText("Current workspace")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select AIadne project" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete Buddy project" })).toBeDisabled();
  });

  it("forwards unlocked select and delete actions", () => {
    const value = props({ projects });
    render(<WorkspaceDialog {...value} />);
    fireEvent.click(screen.getByRole("button", { name: "Select Buddy project" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Buddy project" }));
    expect(value.onSelect).toHaveBeenCalledWith("p2");
    expect(value.onDelete).toHaveBeenCalledWith(projects[1]);
  });

  it("controls the form, folder action, validation, close, and backdrop dismissal", () => {
    const value = props({ name: "AIadne", path: "/work/aiadne" });
    const { container } = render(<WorkspaceDialog {...value} />);
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Next" } });
    fireEvent.change(screen.getByLabelText("Project path"), { target: { value: "/next" } });
    fireEvent.click(screen.getByRole("button", { name: "Choose Folder" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Project" }));
    fireEvent.click(screen.getByRole("button", { name: "Close workspace picker" }));
    fireEvent.mouseDown(container.querySelector(".modal-backdrop")!);
    expect(value.onChangeName).toHaveBeenCalledWith("Next");
    expect(value.onChangePath).toHaveBeenCalledWith("/next");
    expect(value.onChooseFolder).toHaveBeenCalledOnce();
    expect(value.onAdd).toHaveBeenCalledOnce();
    expect(value.onClose).toHaveBeenCalledTimes(2);

    const locked = props({ folderPicking: true, name: "AIadne", path: "/work/aiadne" });
    render(<WorkspaceDialog {...locked} />);
    const chooseFolderButtons = screen.getAllByRole("button", { name: "Choose Folder" });
    const addProjectButtons = screen.getAllByRole("button", { name: "Add Project" });
    expect(chooseFolderButtons[chooseFolderButtons.length - 1]).toBeDisabled();
    expect(addProjectButtons[addProjectButtons.length - 1]).toBeDisabled();
  });
});
