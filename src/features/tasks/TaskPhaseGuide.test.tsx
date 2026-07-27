import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskPhaseGuide } from "./TaskPhaseGuide";

describe("TaskPhaseGuide", () => {
  it("marks Run and Prepare as optional helpers without claiming history", () => {
    render(<TaskPhaseGuide hasRun={false} hasDraft={false} hasEvidence={false} reviewed={false} />);
    expect(screen.getByText("Run").closest("li")).toHaveAttribute("data-status", "optional");
    expect(screen.getByText("Prepare").closest("li")).toHaveAttribute("data-status", "optional");
    expect(screen.getByText(/or author evidence manually/)).toBeInTheDocument();
  });

  it("moves the next action from draft to evidence review", () => {
    const view = render(<TaskPhaseGuide hasRun hasDraft hasEvidence={false} reviewed={false} />);
    expect(screen.getByText("Run").closest("li")).toHaveAttribute("data-status", "complete");
    expect(screen.getByText("Prepare").closest("li")).toHaveAttribute("data-status", "complete");
    expect(screen.getByText("Save evidence").closest("li")).toHaveAttribute("data-status", "current");
    view.rerender(<TaskPhaseGuide hasRun hasDraft={false} hasEvidence reviewed={false} />);
    expect(screen.getByText("Review").closest("li")).toHaveAttribute("data-status", "current");
  });

  it("makes completion current only after review", () => {
    render(<TaskPhaseGuide hasRun hasDraft={false} hasEvidence reviewed />);
    expect(screen.getByText("Complete").closest("li")).toHaveAttribute("data-status", "current");
    expect(screen.getByText(/reveal the next pending phase/)).toBeInTheDocument();
  });
});
