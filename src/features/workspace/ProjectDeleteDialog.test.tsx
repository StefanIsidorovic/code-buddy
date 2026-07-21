import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectInfo } from "../../types/domain";
import { ProjectDeleteDialog, type ProjectDeleteDialogProps } from "./ProjectDeleteDialog";

const project: ProjectInfo = { id: "p1", name: "AIadne", path: "/work/aiadne",
  createdAt: 1, updatedAt: 1 };
function props(overrides: Partial<ProjectDeleteDialogProps> = {}): ProjectDeleteDialogProps {
  return { busy: false, error: null, project, onClose: vi.fn(), onConfirm: vi.fn(), ...overrides };
}

describe("project delete dialog", () => {
  it("renders the project and complete deletion consequences", () => {
    render(<ProjectDeleteDialog {...props()} />);
    expect(screen.getByRole("dialog", { name: "Delete Project" })).toBeInTheDocument();
    expect(screen.getByText("AIadne")).toBeInTheDocument();
    expect(screen.getByText(/Saved transcripts are kept without the project link/)).toBeInTheDocument();
    expect(screen.getByText(/Running ACP sessions will be stopped first/)).toBeInTheDocument();
  });

  it("renders errors and forwards confirmation", () => {
    const value = props({ error: "Delete failed" }); render(<ProjectDeleteDialog {...value} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Delete failed");
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete project" }));
    expect(value.onConfirm).toHaveBeenCalledOnce();
  });

  it("forwards close, cancel, and backdrop dismissal", () => {
    const value = props(); const { container } = render(<ProjectDeleteDialog {...value} />);
    fireEvent.click(screen.getByRole("button", { name: "Close delete project dialog" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.mouseDown(container.querySelector(".modal-backdrop")!);
    expect(value.onClose).toHaveBeenCalledTimes(3);
  });

  it("locks every explicit action while deletion is busy", () => {
    const value = props({ busy: true });
    const { container } = render(<ProjectDeleteDialog {...value} />);
    expect(screen.getByRole("button", { name: "Close delete project dialog" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Confirm delete project" })).toBeDisabled();
    fireEvent.mouseDown(container.querySelector(".modal-backdrop")!);
    expect(value.onClose).toHaveBeenCalledOnce();
  });
});
