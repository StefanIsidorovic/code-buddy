import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskPhaseGuide } from "./TaskPhaseGuide";

describe("TaskPhaseGuide", () => {
  const props = { phase: "analysis" as const, hasEvidenceText: false, provenanceCount: 0,
    hasPhaseRun: false, hasEvidence: false, reviewed: false };
  it("starts with evidence creation instead of Run and Prepare pseudo-steps", () => {
    render(<TaskPhaseGuide {...props} />);
    expect(screen.getByText("Analysis evidence").closest("li"))
      .toHaveAttribute("data-status", "current");
    expect(screen.queryByText("Run")).not.toBeInTheDocument();
    expect(screen.queryByText("Prepare")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/or write it manually/);
  });

  it("moves the next action from draft to evidence review", () => {
    const view = render(<TaskPhaseGuide {...props} hasEvidenceText provenanceCount={1} />);
    expect(screen.getByText("Analysis evidence").closest("li"))
      .toHaveAttribute("data-status", "complete");
    expect(screen.getByText("Save evidence").closest("li")).toHaveAttribute("data-status", "current");
    view.rerender(<TaskPhaseGuide {...props} hasEvidence />);
    expect(screen.getByText("Review").closest("li")).toHaveAttribute("data-status", "current");
  });

  it("makes completion current only after review", () => {
    render(<TaskPhaseGuide {...props} phase="review" hasEvidence reviewed />);
    expect(screen.getByText("Complete").closest("li")).toHaveAttribute("data-status", "current");
    expect(screen.getByText(/reveal the next pending phase/)).toBeInTheDocument();
  });

  it("distinguishes analysis and planning outcomes", () => {
    const view = render(<TaskPhaseGuide {...props} />);
    expect(screen.getByText(/Investigate boundaries, constraints/)).toBeInTheDocument();
    view.rerender(<TaskPhaseGuide {...props} phase="planning" />);
    expect(screen.getByText("Planning evidence")).toBeInTheDocument();
    expect(screen.getByText(/concrete, ordered implementation and verification plan/))
      .toBeInTheDocument();
  });

  it("keeps precise next-action readiness inside the tracker", () => {
    const view = render(<TaskPhaseGuide {...props} hasPhaseRun />);
    expect(screen.getByRole("status")).toHaveTextContent(/Review the prepared evidence text/);
    expect(screen.getByText("Evidence text: required")).toBeInTheDocument();
    expect(screen.getByText("Transcript provenance: select at least one event")).toBeInTheDocument();
    view.rerender(<TaskPhaseGuide {...props} hasEvidenceText provenanceCount={2} />);
    expect(screen.getByRole("status")).toHaveTextContent(/ready. Save phase evidence/);
    expect(screen.getByText("Evidence text: ready")).toBeInTheDocument();
    expect(screen.getByText("Transcript provenance: 2 selected")).toBeInTheDocument();
  });
});
