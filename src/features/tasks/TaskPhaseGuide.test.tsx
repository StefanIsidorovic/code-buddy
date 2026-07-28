import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskPhaseGuide } from "./TaskPhaseGuide";

describe("TaskPhaseGuide", () => {
  it("starts with evidence creation instead of Run and Prepare pseudo-steps", () => {
    render(<TaskPhaseGuide phase="analysis" hasDraft={false} hasEvidence={false} reviewed={false} />);
    expect(screen.getByText("Analysis evidence").closest("li"))
      .toHaveAttribute("data-status", "current");
    expect(screen.queryByText("Run")).not.toBeInTheDocument();
    expect(screen.queryByText("Prepare")).not.toBeInTheDocument();
    expect(screen.getByText(/or author evidence manually/)).toBeInTheDocument();
  });

  it("moves the next action from draft to evidence review", () => {
    const view = render(<TaskPhaseGuide phase="analysis" hasDraft hasEvidence={false} reviewed={false} />);
    expect(screen.getByText("Analysis evidence").closest("li"))
      .toHaveAttribute("data-status", "complete");
    expect(screen.getByText("Save evidence").closest("li")).toHaveAttribute("data-status", "current");
    view.rerender(<TaskPhaseGuide phase="analysis" hasDraft={false} hasEvidence reviewed={false} />);
    expect(screen.getByText("Review").closest("li")).toHaveAttribute("data-status", "current");
  });

  it("makes completion current only after review", () => {
    render(<TaskPhaseGuide phase="review" hasDraft={false} hasEvidence reviewed />);
    expect(screen.getByText("Complete").closest("li")).toHaveAttribute("data-status", "current");
    expect(screen.getByText(/reveal the next pending phase/)).toBeInTheDocument();
  });

  it("distinguishes analysis and planning outcomes", () => {
    const view = render(<TaskPhaseGuide phase="analysis" hasDraft={false}
      hasEvidence={false} reviewed={false} />);
    expect(screen.getByText(/Investigate boundaries, constraints/)).toBeInTheDocument();
    view.rerender(<TaskPhaseGuide phase="planning" hasDraft={false}
      hasEvidence={false} reviewed={false} />);
    expect(screen.getByText("Planning evidence")).toBeInTheDocument();
    expect(screen.getByText(/concrete, ordered implementation and verification plan/))
      .toBeInTheDocument();
  });
});
