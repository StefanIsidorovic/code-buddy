import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectRepositoryInfo } from "../../types/domain";
import {
  ProjectInitializeDialog,
  type ProjectInitializeDialogProps,
} from "./ProjectInitializeDialog";

const repositories: ProjectRepositoryInfo[] = [
  { id: "r1", projectId: "p1", name: "core", path: "/work/core", isDefault: true,
    createdAt: 1, updatedAt: 1 },
  { id: "r2", projectId: "p1", name: "ui", path: "/work/ui", isDefault: false,
    createdAt: 1, updatedAt: 1 },
];

function props(overrides: Partial<ProjectInitializeDialogProps> = {}): ProjectInitializeDialogProps {
  return { error: null, loading: false, repositories, selectedRepositoryIds: [],
    onClose: vi.fn(), onStart: vi.fn(), onToggleRepository: vi.fn(), ...overrides };
}

describe("project initialize dialog", () => {
  it("renders repositories and phases and forwards checkbox changes", () => {
    const value = props();
    render(<ProjectInitializeDialog {...value} />);
    expect(screen.getByText("Markdown analysis")).toBeInTheDocument();
    expect(screen.getByText("Knowledge summary")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Include ui repository"));
    expect(value.onToggleRepository).toHaveBeenCalledWith("r2", true);
  });

  it("renders selected scope and starts initialization", () => {
    const value = props({ selectedRepositoryIds: ["r1"] });
    render(<ProjectInitializeDialog {...value} />);
    expect(screen.getByLabelText("Include core repository")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Include core repository"));
    expect(value.onToggleRepository).toHaveBeenCalledWith("r1", false);
    fireEvent.click(screen.getByRole("button", { name: "Start Initialize" }));
    expect(value.onStart).toHaveBeenCalledOnce();
  });

  it("requires scope and preserves the existing loading locks", () => {
    const { rerender } = render(<ProjectInitializeDialog {...props()} />);
    expect(screen.getByRole("button", { name: "Start Initialize" })).toBeDisabled();
    rerender(<ProjectInitializeDialog {...props({ loading: true, selectedRepositoryIds: ["r1"] })} />);
    expect(screen.getByRole("button", { name: "Close project initialize dialog" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Start Initialize" })).toBeDisabled();
    expect(screen.getByLabelText("Include core repository")).toBeEnabled();
  });

  it("renders errors and forwards close and backdrop dismissal", () => {
    const value = props({ error: "Initialization failed." });
    const { container } = render(<ProjectInitializeDialog {...value} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Initialization failed.");
    fireEvent.click(screen.getByRole("button", { name: "Close project initialize dialog" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.mouseDown(container.querySelector(".modal-backdrop")!);
    expect(value.onClose).toHaveBeenCalledTimes(3);
  });
});
