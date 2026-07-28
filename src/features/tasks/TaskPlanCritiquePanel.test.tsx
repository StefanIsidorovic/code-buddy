import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskPlanEvaluationInfo } from "../../types/domain";
import { TaskPlanCritiquePanel } from "./TaskPlanCritiquePanel";

const evaluation = {
  id: "evaluation-1", findings: [{ id: "GAP:REQ-1" }],
} as TaskPlanEvaluationInfo;

describe("TaskPlanCritiquePanel", () => {
  it("stays absent when deterministic evaluation is clean", () => {
    const { container } = render(<TaskPlanCritiquePanel
      evaluation={{ ...evaluation, findings: [] }} critique={null} loading={false}
      canRun onRun={vi.fn()} onApply={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("explains the grounded boundary and runs deliberately", () => {
    const onRun = vi.fn();
    render(<TaskPlanCritiquePanel evaluation={evaluation} critique={null} loading={false}
      canRun onRun={onRun} onApply={vi.fn()} />);
    expect(screen.getByText(/Every claim must cite a finding ID/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run grounded critique" }));
    expect(onRun).toHaveBeenCalledOnce();
  });

  it("shows only persisted grounded issues and their proposed repairs", () => {
    const onApply = vi.fn();
    render(<TaskPlanCritiquePanel evaluation={evaluation} loading={false} canRun onRun={vi.fn()}
      onApply={onApply}
      critique={{ id: "critique-1", taskId: "task-1", planVersionId: "plan-1",
        evaluationId: "evaluation-1", source: "codex-acp", createdAt: 3,
        issues: [{ findingIds: ["GAP:REQ-1"], explanation: "Requirement is uncovered",
          proposedRepair: "Add a linked implementation step", repairs: [{
            kind: "add_step", title: "Cover requirement", description: "Implement it",
            complexity: 2, acceptanceCriteria: ["Pass"], expectedPaths: ["src/**"],
            satisfies: ["REQ-1"],
          }] }] }} />);
    expect(screen.getByText("GAP:REQ-1")).toBeInTheDocument();
    expect(screen.getByText("Requirement is uncovered")).toBeInTheDocument();
    expect(screen.getByText(/Add a linked implementation step/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run grounded critique" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply repairs as new version" }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(screen.getByText(/must pass deterministic evaluation before approval/)).toBeInTheDocument();
  });
});
