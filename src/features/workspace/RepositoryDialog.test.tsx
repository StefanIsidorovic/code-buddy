import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectInfo, ProjectRepositoryInfo } from "../../types/domain";
import { RepositoryDialog, type RepositoryDialogProps } from "./RepositoryDialog";

const project: ProjectInfo = { id: "p1", name: "AIadne", path: "/work", createdAt: 1, updatedAt: 1 };
const repositories: ProjectRepositoryInfo[] = [
  { id: "r1", projectId: "p1", name: "core", path: "/work/core", isDefault: true, createdAt: 1, updatedAt: 1 },
  { id: "r2", projectId: "p1", name: "ui", path: "/work/ui", isDefault: false, createdAt: 1, updatedAt: 1 },
];
function props(overrides: Partial<RepositoryDialogProps> = {}): RepositoryDialogProps {
  return { busy: false, loading: false, name: "", path: "", project, repositories: [],
    selectedRepositoryId: null, sessionLocked: false, onAdd: vi.fn(), onChangeName: vi.fn(),
    onChangePath: vi.fn(), onClose: vi.fn(), onDelete: vi.fn(), onRefresh: vi.fn(),
    onSelect: vi.fn(), ...overrides };
}

describe("repository dialog", () => {
  it("renders the empty state and refreshes", () => {
    const value = props(); render(<RepositoryDialog {...value} />);
    expect(screen.getByText("No repositories yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(value.onRefresh).toHaveBeenCalledOnce();
  });

  it("protects selected/default rows and locks mutations during a session", () => {
    render(<RepositoryDialog {...props({ repositories, selectedRepositoryId: "r1",
      sessionLocked: true, name: "next", path: "/next" })} />);
    expect(screen.getByRole("button", { name: "Select core repository" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete core repository" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete ui repository" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add Repository" })).toBeEnabled();
  });

  it("forwards unlocked select and delete actions", () => {
    const value = props({ repositories }); render(<RepositoryDialog {...value} />);
    fireEvent.click(screen.getByRole("button", { name: "Select ui repository" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete ui repository" }));
    expect(value.onSelect).toHaveBeenCalledWith("r2");
    expect(value.onDelete).toHaveBeenCalledWith("r2");
  });

  it("controls form changes, validation, close, and backdrop dismissal", () => {
    const value = props({ name: "ui", path: "/work/ui" });
    const { container } = render(<RepositoryDialog {...value} />);
    fireEvent.change(screen.getByLabelText("Repository name"), { target: { value: "next" } });
    fireEvent.change(screen.getByLabelText("Repository path"), { target: { value: "/next" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Repository" }));
    fireEvent.click(screen.getByRole("button", { name: "Close repository picker" }));
    fireEvent.mouseDown(container.querySelector(".modal-backdrop")!);
    expect(value.onChangeName).toHaveBeenCalledWith("next");
    expect(value.onChangePath).toHaveBeenCalledWith("/next");
    expect(value.onAdd).toHaveBeenCalledOnce();
    expect(value.onClose).toHaveBeenCalledTimes(2);
  });
});
