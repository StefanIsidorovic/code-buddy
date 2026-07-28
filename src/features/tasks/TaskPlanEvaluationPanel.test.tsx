import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskPlanEvaluationInfo, TaskPlanVersionInfo } from "../../types/domain";
import { TaskPlanEvaluationPanel } from "./TaskPlanEvaluationPanel";

const plan = { id: "plan-1", version: 2 } as TaskPlanVersionInfo;

describe("TaskPlanEvaluationPanel", () => {
  it("offers deterministic evaluation before a result exists", () => {
    const onEvaluate = vi.fn();
    render(<TaskPlanEvaluationPanel plan={plan} evaluation={null} loading={false}
      onEvaluate={onEvaluate} />);
    fireEvent.click(screen.getByRole("button", { name: "Evaluate plan v2" }));
    expect(onEvaluate).toHaveBeenCalledWith("plan-1");
    expect(screen.getByText(/without using a model/)).toBeInTheDocument();
  });

  it("triages blocking findings with stable evidence IDs", () => {
    const evaluation: TaskPlanEvaluationInfo = {
      id: "evaluation-1", taskId: "task-1", planVersionId: "plan-1",
      planVersion: 2, verdict: "blocked", createdAt: 1, findings: [{
      id: "GAP:REQ-2", code: "GAP", severity: "blocking",
      message: "REQ-2 is not satisfied by any implementation step.",
      requirementId: "REQ-2", stepIds: [],
    }] };
    render(<TaskPlanEvaluationPanel plan={plan} evaluation={evaluation} loading={false}
      onEvaluate={vi.fn()} />);
    expect(screen.getByText(/0 warning/)).toBeInTheDocument();
    expect(screen.getByText("GAP:REQ-2")).toBeInTheDocument();
    expect(screen.getByText(/not satisfied/)).toBeInTheDocument();
  });
});
