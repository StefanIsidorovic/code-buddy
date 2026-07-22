import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AcpWorkspaceViews } from "./AcpWorkspaceViews";

function renderWorkspace(task: boolean) {
  return render(<AcpWorkspaceViews agent={<div>ACP Controls body</div>}
    output={<div>Session Output body</div>} task={task ? <div>Task phase body</div> : null}
    activity={task ? <div>Receipt history body</div> : null} currentPhase={task ? "analysis" : null}
    phaseRunCount={2} contextDispatchCount={1} reportCount={3} />);
}

describe("AcpWorkspaceViews", () => {
  it("keeps controls and output together in the default Agent view", () => {
    renderWorkspace(true);
    expect(screen.getByRole("tab", { name: /Agent/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("ACP Controls body")).toBeInTheDocument();
    expect(screen.getByText("Session Output body")).toBeInTheDocument();
    expect(screen.queryByText("Task phase body")).not.toBeInTheDocument();
  });

  it("switches between the Task and Activity workspaces", () => {
    renderWorkspace(true);
    fireEvent.click(screen.getByRole("tab", { name: /Task/ }));
    expect(screen.getByText("Task phase body")).toBeInTheDocument();
    expect(screen.queryByText("Session Output body")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Activity/ }));
    expect(screen.getByText("Receipt history body")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /2 run\(s\) · 1 send\(s\) · 3 report\(s\)/ })).toHaveAttribute(
      "aria-selected", "true");
  });

  it("supports arrow-key navigation between available views", () => {
    renderWorkspace(true);
    const agentTab = screen.getByRole("tab", { name: /Agent/ });
    agentTab.focus();
    fireEvent.keyDown(agentTab, { key: "ArrowRight" });
    const taskTab = screen.getByRole("tab", { name: /Task/ });
    expect(taskTab).toHaveFocus();
    expect(taskTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Task phase body")).toBeInTheDocument();
  });

  it("disables Task-owned views without an active Task", () => {
    renderWorkspace(false);
    expect(screen.getByRole("tab", { name: /Task/ })).toBeDisabled();
    expect(screen.getByRole("tab", { name: /Activity/ })).toBeDisabled();
    expect(screen.getByText("Session Output body")).toBeInTheDocument();
  });

  it("returns to Agent when the active Task disappears", () => {
    const { rerender } = renderWorkspace(true);
    fireEvent.click(screen.getByRole("tab", { name: /Task/ }));
    rerender(<AcpWorkspaceViews agent={<div>ACP Controls body</div>}
      output={<div>Session Output body</div>} task={null} activity={null} currentPhase={null}
      phaseRunCount={0} contextDispatchCount={0} reportCount={0} />);
    expect(screen.getByRole("tab", { name: /Agent/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Session Output body")).toBeInTheDocument();
  });
});
