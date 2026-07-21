import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskWorkflowRegion } from "./TaskWorkflowRegion";

describe("TaskWorkflowRegion", () => {
  it("keeps the phase primary and groups activity in a native disclosure", () => {
    render(<TaskWorkflowRegion phase={<div>Current phase</div>} phaseRunHistory={<div>Run history</div>}
      contextDispatchHistory={<div>Context history</div>} phaseRunCount={2} contextDispatchCount={1} />);
    expect(screen.getByRole("region", { name: "Task workflow" })).toHaveTextContent("Current phase");
    const disclosure = screen.getByText("Task activity").closest("details");
    expect(disclosure).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Task activity"));
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getByText("2 phase run(s) · 1 context send(s)")).toBeInTheDocument();
  });
});
