import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AcpWorkspaceViews } from "./AcpWorkspaceViews";

function renderWorkspace(task = true, overrides = {}) {
  return render(<AcpWorkspaceViews activeView="task" agent={<div>ACP Controls body</div>}
    knowledge={<div>Project Knowledge body</div>} output={<div>Session Output body</div>}
    task={task ? <div>Task phase body</div> : null}
    activity={task ? <div>Receipt history body</div> : null} currentPhase={task ? "analysis" : null}
    phaseRunCount={2} contextDispatchCount={1} reportCount={3} pendingPermissionCount={0}
    onChangeView={vi.fn()} {...overrides} />);
}

describe("AcpWorkspaceViews", () => {
  it("renders Agent, Task, and Activity as local tabs above an active Task", () => {
    renderWorkspace();
    expect(screen.getByRole("tab", { name: /Task Current: analysis/ }))
      .toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Task phase body")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Agent Controls & permissions/ }));
    expect(screen.getByText("ACP Controls body")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Activity 2 run/ }));
    expect(screen.getByText("Receipt history body")).toBeInTheDocument();
  });

  it("shows Agent by default and disables Task-owned tabs without a Task", () => {
    renderWorkspace(false);
    expect(screen.getByRole("tab", { name: /Agent/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Task/ })).toBeDisabled();
    expect(screen.getByRole("tab", { name: /Activity/ })).toBeDisabled();
  });

  it("renders Project Knowledge without Task tabs when selected", () => {
    renderWorkspace(true, { activeView: "knowledge" });
    expect(screen.getByText("Project Knowledge body")).toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: "Task workspace views" })).not.toBeInTheDocument();
  });

  it("keeps Session Output visible for every center selection", () => {
    const { rerender } = renderWorkspace();
    expect(screen.getByText("Session Output body")).toBeInTheDocument();
    rerender(<AcpWorkspaceViews activeView="knowledge" agent={<div>ACP Controls body</div>}
      knowledge={<div>Project Knowledge body</div>} output={<div>Session Output body</div>}
      task={<div>Task phase body</div>} activity={<div>Receipt history body</div>}
      currentPhase="analysis" phaseRunCount={0} contextDispatchCount={0} reportCount={0}
      pendingPermissionCount={0} onChangeView={vi.fn()} />);
    expect(screen.getByText("Session Output body")).toBeInTheDocument();
  });

  it("opens Agent tab from a permission alert outside Task workspace", () => {
    const onChangeView = vi.fn(); renderWorkspace(true,
      { activeView: "knowledge", pendingPermissionCount: 1, onChangeView });
    fireEvent.click(screen.getByRole("button", { name: "Review permission" }));
    expect(onChangeView).toHaveBeenCalledWith("task");
  });

  it("supports arrow-key navigation between available local tabs", () => {
    renderWorkspace();
    const taskTab = screen.getByRole("tab", { name: /Task Current: analysis/ }); taskTab.focus();
    fireEvent.keyDown(taskTab, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Activity/ })).toHaveFocus();
  });
});
