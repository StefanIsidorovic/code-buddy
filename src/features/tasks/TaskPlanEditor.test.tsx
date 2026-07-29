import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskPhaseArtifactInfo, TaskPlanVersionInfo } from "../../types/domain";
import { TaskPlanEditor } from "./TaskPlanEditor";

const artifact = (content = "Planning prose"): TaskPhaseArtifactInfo => ({
  id: "artifact-1", taskId: "task-1", phase: "planning", sequence: 0,
  kind: "summary", content, sourceTranscriptEventIds: ["event-1"], createdAt: 1,
});
const generated = {
  requirements: [{ id: "REQ-1", text: "The cache remains bounded", kind: "functional" }],
  steps: [{ title: "Bound the cache", description: "Implement deterministic eviction",
    kind: "implementation", complexity: 2,
    acceptanceCriteria: ["Cache evicts oldest entry", "Focused tests pass"],
    expectedPaths: ["src/cache.ts"], satisfies: ["REQ-1"], dependsOn: [] }],
};
const evidence = () => artifact(`Summary\n\`\`\`json\n${JSON.stringify(generated)}\n\`\`\``);

describe("TaskPlanEditor", () => {
  it("creates a structured version from requirements and ordered steps", () => {
    const onCreate = vi.fn();
    render(<TaskPlanEditor sourceArtifact={artifact()} versions={[]} loading={false}
      error={null} evaluation={null} critique={null} canRunCritique={false}
      onCreate={onCreate} onEvaluate={vi.fn()} onRunCritique={vi.fn()}
      onApplyRepairs={vi.fn()} onApprove={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Requirement 1 text"), {
      target: { value: "The cache remains bounded" },
    });
    fireEvent.change(screen.getByLabelText("Step 1 title"), {
      target: { value: "Bound the cache" },
    });
    fireEvent.change(screen.getByLabelText("Step 1 description"), {
      target: { value: "Implement deterministic eviction" },
    });
    fireEvent.change(screen.getByLabelText("Step 1 acceptance criteria"), {
      target: { value: "Cache evicts oldest entry\nFocused tests pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save new plan version" }));

    expect(onCreate).toHaveBeenCalledWith("artifact-1", {
      requirements: [{ id: "REQ-1", text: "The cache remains bounded", kind: "functional" }],
      steps: [{
        title: "Bound the cache", description: "Implement deterministic eviction",
        kind: "implementation", complexity: 2,
        acceptanceCriteria: ["Cache evicts oldest entry", "Focused tests pass"],
        expectedPaths: [], satisfies: ["REQ-1"], dependsOn: [],
      }],
    });
  });

  it("shows an approved plan read-only", () => {
    const approved = {
      id: "plan-1", taskId: "task-1", version: 2, status: "approved",
      sourceArtifactId: "artifact-1", createdAt: 1, approvedAt: 2,
      requirements: [{ id: "REQ-1", text: "Bounded", kind: "functional", orderIndex: 0 }],
      steps: [{ id: "step-1", orderIndex: 0, title: "Bound cache", description: "Add eviction",
        kind: "implementation", complexity: 2, acceptanceCriteria: ["Pass"],
        expectedPaths: ["src/**"], satisfies: ["REQ-1"], dependsOn: [] }],
    } as TaskPlanVersionInfo;
    render(<TaskPlanEditor sourceArtifact={artifact()} versions={[approved]} loading={false}
      error={null} evaluation={null} critique={null} canRunCritique={false}
      onCreate={vi.fn()} onEvaluate={vi.fn()} onRunCritique={vi.fn()}
      onApplyRepairs={vi.fn()} onApprove={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Approved implementation plan" })).toBeInTheDocument();
    expect(screen.getByText("1. Bound cache")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save new plan version" })).not.toBeInTheDocument();
  });

  it("automatically fills a pristine editor from validated planning evidence", () => {
    const onCreate = vi.fn();
    render(<TaskPlanEditor sourceArtifact={evidence()} versions={[]} loading={false}
      error={null} evaluation={null} critique={null} canRunCritique={false}
      onCreate={onCreate} onEvaluate={vi.fn()} onRunCritique={vi.fn()}
      onApplyRepairs={vi.fn()} onApprove={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Agent-generated draft");
    expect(screen.getByLabelText("Requirement 1 text")).toHaveValue("The cache remains bounded");
    expect(screen.getByLabelText("Step 1 expected paths")).toHaveValue("src/cache.ts");
    fireEvent.click(screen.getByRole("button", { name: "Save new plan version" }));
    expect(onCreate).toHaveBeenCalledWith("artifact-1", generated);
  });

  it("preserves manual edits when newer evidence arrives and restores only on request", () => {
    const common = { versions: [], loading: false, error: null, evaluation: null, critique: null,
      canRunCritique: false, onCreate: vi.fn(), onEvaluate: vi.fn(), onRunCritique: vi.fn(),
      onApplyRepairs: vi.fn(), onApprove: vi.fn() };
    const view = render(<TaskPlanEditor {...common} sourceArtifact={artifact()} />);
    fireEvent.change(screen.getByLabelText("Requirement 1 text"),
      { target: { value: "Manual requirement" } });
    view.rerender(<TaskPlanEditor {...common} sourceArtifact={evidence()} />);
    expect(screen.getByLabelText("Requirement 1 text")).toHaveValue("Manual requirement");
    fireEvent.click(screen.getByRole("button", { name: "Restore from planning evidence" }));
    expect(screen.getByLabelText("Requirement 1 text")).toHaveValue("The cache remains bounded");
  });

  it("explains the manual fallback when saved evidence has no valid structured draft", () => {
    render(<TaskPlanEditor sourceArtifact={artifact("Ordinary prose")} versions={[]} loading={false}
      error={null} evaluation={null} critique={null} canRunCritique={false}
      onCreate={vi.fn()} onEvaluate={vi.fn()} onRunCritique={vi.fn()}
      onApplyRepairs={vi.fn()} onApprove={vi.fn()} />);
    expect(screen.getByRole("note")).toHaveTextContent("Fill the form manually or rerun");
    expect(screen.getByLabelText("Requirement 1 text")).toBeEnabled();
  });
});
