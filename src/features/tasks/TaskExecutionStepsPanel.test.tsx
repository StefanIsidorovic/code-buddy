import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskPlanStepRunInfo, TaskPlanVersionInfo } from "../../types/domain";
import { TaskExecutionStepsPanel } from "./TaskExecutionStepsPanel";

const plan: TaskPlanVersionInfo = { id: "plan-1", taskId: "task-1", version: 1,
  status: "approved", sourceArtifactId: "artifact-1", requirements: [],
  createdAt: 1, approvedAt: 1, steps: [
  { id: "step-1", orderIndex: 0, title: "Implement cache", description: "Change cache",
    kind: "implementation", complexity: 2, acceptanceCriteria: ["Tests pass"],
    expectedPaths: ["src/cache.ts"], satisfies: [], dependsOn: [] },
  { id: "step-2", orderIndex: 1, title: "Verify cache", description: "Run checks",
    kind: "infrastructure", complexity: 1, acceptanceCriteria: ["Checks recorded"],
    expectedPaths: [], satisfies: [], dependsOn: ["STEP-1"] },
] };
const sent = { id: "run-1", planStepId: "step-1", attempt: 1, status: "sent",
  modelTier: "small", verificationStatus: "changed", scopeStatus: "within_scope",
  verificationChangedFiles: ["src/cache.ts"], scopeViolations: [], error: null,
  taskId: "task-1", planVersionId: "plan-1", stepOrderIndex: 0, acpSessionId: "acp-1",
  instruction: "Run step", modelTierRationale: "complexity 2/5", expectedPaths: ["src/cache.ts"],
  stopReason: "end_turn", verificationWorkspacePath: "/repo", verificationError: null,
  reviewStatus: null, reviewNote: null, createdAt: 1, updatedAt: 1 } satisfies TaskPlanStepRunInfo;

describe("TaskExecutionStepsPanel", () => {
  it("runs only the next step and requires a review note before acceptance", () => {
    const onRun = vi.fn(); const onReview = vi.fn();
    const view = render(<TaskExecutionStepsPanel plan={plan} runs={[]} nextStep={plan.steps[0]}
      canRun loading={false} actionRunId={null} error={null}
      onRun={onRun} onReview={onReview} />);
    fireEvent.click(screen.getByRole("button", { name: "Run this step" }));
    expect(onRun).toHaveBeenCalledOnce();
    view.rerender(<TaskExecutionStepsPanel plan={plan} runs={[sent]} nextStep={plan.steps[0]}
      canRun loading={false} actionRunId={null} error={null}
      onRun={onRun} onReview={onReview} />);
    expect(screen.getByRole("button", { name: "Accept step" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Review note"), { target: { value: "Scope verified" } });
    fireEvent.click(screen.getByRole("button", { name: "Accept step" }));
    expect(onReview).toHaveBeenCalledWith("run-1", "accept", "Scope verified");
    fireEvent.click(screen.getByText("Execution waves · 2"));
    expect(screen.getByText("Wave 1 · serial")).toBeInTheDocument();
    expect(screen.getByText("Wave 2 · serial")).toBeInTheDocument();
    expect(screen.getByText(/Runs remain serial/)).toBeInTheDocument();
  });

  it("shows scope violations and prevents acceptance while allowing rejection", () => {
    const onReview = vi.fn();
    render(<TaskExecutionStepsPanel plan={plan} runs={[{ ...sent, scopeStatus: "out_of_scope",
      scopeViolations: ["src/other.ts"] }]} nextStep={plan.steps[0]} canRun loading={false}
      actionRunId={null} error={null} onRun={vi.fn()} onReview={onReview} />);
    expect(screen.getByRole("alert")).toHaveTextContent("src/other.ts");
    fireEvent.change(screen.getByLabelText("Review note"), { target: { value: "Unexpected file" } });
    expect(screen.getByRole("button", { name: "Accept step" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reject & retry" }));
    expect(onReview).toHaveBeenCalledWith("run-1", "reject", "Unexpected file");
  });
});
