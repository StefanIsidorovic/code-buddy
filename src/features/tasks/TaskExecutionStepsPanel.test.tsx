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
  isolationId: null, isolationRepositoryPath: null, isolationWorktreePath: null,
  isolationBranch: null, isolationBaseSha: null, integrationStatus: null,
  isolatedCommitSha: null, integratedCommitSha: null, integrationError: null,
  stopReason: "end_turn", verificationWorkspacePath: "/repo", verificationError: null,
  reviewStatus: null, reviewNote: null, createdAt: 1, updatedAt: 1 } satisfies TaskPlanStepRunInfo;

describe("TaskExecutionStepsPanel", () => {
  it("runs only the next step and requires a review note before acceptance", () => {
    const onRun = vi.fn(); const onReview = vi.fn();
    const view = render(<TaskExecutionStepsPanel plan={plan} runs={[]} nextStep={plan.steps[0]}
      runBlockedReason={null} loading={false} actionRunId={null} error={null}
      cleanupWarnings={{}} onRun={onRun} onReview={onReview} onIntegrate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Run this step" }));
    expect(onRun).toHaveBeenCalledOnce();
    view.rerender(<TaskExecutionStepsPanel plan={plan} runs={[sent]} nextStep={plan.steps[0]}
      runBlockedReason={null} loading={false} actionRunId={null} error={null}
      cleanupWarnings={{}} onRun={onRun} onReview={onReview} onIntegrate={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Accept step" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Review note"), { target: { value: "Scope verified" } });
    fireEvent.click(screen.getByRole("button", { name: "Accept step" }));
    expect(onReview).toHaveBeenCalledWith("run-1", "accept", "Scope verified");
    fireEvent.click(screen.getByText("Execution waves · 2"));
    expect(screen.getByText("Wave 1 · serial")).toBeInTheDocument();
    expect(screen.getByText("Wave 2 · serial")).toBeInTheDocument();
    expect(screen.getByText(/Runs are still dispatched serially/)).toBeInTheDocument();
  });

  it("shows scope violations and prevents acceptance while allowing rejection", () => {
    const onReview = vi.fn();
    render(<TaskExecutionStepsPanel plan={plan} runs={[{ ...sent, scopeStatus: "out_of_scope",
      scopeViolations: ["src/other.ts"] }]} nextStep={plan.steps[0]}
      runBlockedReason={null} loading={false}
      actionRunId={null} error={null} cleanupWarnings={{}} onRun={vi.fn()}
      onReview={onReview} onIntegrate={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("src/other.ts");
    fireEvent.change(screen.getByLabelText("Review note"), { target: { value: "Unexpected file" } });
    expect(screen.getByRole("button", { name: "Accept step" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reject & retry" }));
    expect(onReview).toHaveBeenCalledWith("run-1", "reject", "Unexpected file");
  });

  it("integrates only an accepted isolated run and distinguishes Git success from cleanup", () => {
    const onIntegrate = vi.fn();
    const isolated = { ...sent, status: "accepted" as const, reviewStatus: "accepted" as const,
      isolationId: "isolation-1", isolationRepositoryPath: "/repo",
      isolationWorktreePath: "/tmp/aiadne-task-worktrees/isolation-1",
      isolationBranch: "aiadne/task-1/step-1/attempt-1-isolation-1",
      isolationBaseSha: "aaaaaaaa", integrationStatus: null };
    const view = render(<TaskExecutionStepsPanel plan={plan} runs={[isolated]}
      nextStep={plan.steps[0]} runBlockedReason={null} loading={false}
      actionRunId={null} error={null}
      cleanupWarnings={{}} onRun={vi.fn()} onReview={vi.fn()} onIntegrate={onIntegrate} />);
    fireEvent.click(screen.getByRole("button", { name: "Integrate accepted step" }));
    expect(onIntegrate).toHaveBeenCalledWith("run-1");
    view.rerender(<TaskExecutionStepsPanel plan={plan} runs={[{ ...isolated,
      integrationStatus: "integrated", isolatedCommitSha: "bbbbbbbb",
      integratedCommitSha: "cccccccc" }]} nextStep={plan.steps[1]}
      runBlockedReason={null} loading={false}
      actionRunId={null} error={null} cleanupWarnings={{ "run-1": "session already stopped" }}
      onRun={vi.fn()} onReview={vi.fn()} onIntegrate={onIntegrate} />);
    expect(screen.queryByRole("button", { name: "Integrate accepted step" })).not.toBeInTheDocument();
    expect(screen.getByText(/Integrated commit/)).toHaveTextContent("cccccccc");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Integrated successfully, but cleanup needs attention",
    );
  });

  it("shows a durable integration conflict without offering a duplicate action", () => {
    render(<TaskExecutionStepsPanel plan={plan} runs={[{ ...sent, status: "accepted",
      reviewStatus: "accepted", isolationId: "isolation-1", integrationStatus: "conflicted",
      integrationError: "cherry-pick conflict" }]} nextStep={plan.steps[0]}
      runBlockedReason={null} loading={false}
      actionRunId={null} error={null} cleanupWarnings={{}} onRun={vi.fn()}
      onReview={vi.fn()} onIntegrate={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "cherry-pick conflict. Isolation retained for recovery",
    );
    expect(screen.queryByRole("button", { name: "Integrate accepted step" })).not.toBeInTheDocument();
  });

  it("explains why an isolated step cannot start", () => {
    render(<TaskExecutionStepsPanel plan={plan} runs={[]} nextStep={plan.steps[0]}
      runBlockedReason="Select a registered project repository to run the next isolated step."
      loading={false} actionRunId={null} error={null} cleanupWarnings={{}} onRun={vi.fn()}
      onReview={vi.fn()} onIntegrate={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Run this step" })).toBeDisabled();
    expect(screen.getByText(/registered project repository/)).toBeInTheDocument();
  });
});
