import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceNavigation } from "./WorkspaceNavigation";

function props(overrides = {}) {
  return { activeView: "task" as const, currentPhase: null, initializationStatus: "summary",
    pendingPermissionCount: 0, onChangeView: vi.fn(), ...overrides };
}

describe("WorkspaceNavigation", () => {
  it("offers only Project Knowledge and Task as primary sidebar destinations", () => {
    const value = props(); render(<WorkspaceNavigation {...value} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /Task/ })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: /Project Knowledge/ }));
    expect(value.onChangeView).toHaveBeenCalledWith("knowledge");
  });

  it("summarizes the active phase and pending permissions on Task", () => {
    render(<WorkspaceNavigation {...props({ currentPhase: "analysis", pendingPermissionCount: 2 })} />);
    expect(screen.getByRole("button", { name: /Task Current: analysis/ })).toBeInTheDocument();
    expect(screen.getByLabelText("2 pending permission requests")).toBeInTheDocument();
  });
});
