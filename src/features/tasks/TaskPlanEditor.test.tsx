import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskPlanVersionInfo } from "../../types/domain";
import { TaskPlanEditor } from "./TaskPlanEditor";

describe("TaskPlanEditor", () => {
  it("creates a structured version from requirements and ordered steps", () => {
    const onCreate = vi.fn();
    render(<TaskPlanEditor sourceArtifactId="artifact-1" versions={[]} loading={false}
      error={null} evaluation={null} critique={null} canRunCritique={false}
      onCreate={onCreate} onEvaluate={vi.fn()} onRunCritique={vi.fn()} onApprove={vi.fn()} />);
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
        expectedPaths: [], satisfies: ["REQ-1"],
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
        expectedPaths: ["src/**"], satisfies: ["REQ-1"] }],
    } as TaskPlanVersionInfo;
    render(<TaskPlanEditor sourceArtifactId="artifact-1" versions={[approved]} loading={false}
      error={null} evaluation={null} critique={null} canRunCritique={false}
      onCreate={vi.fn()} onEvaluate={vi.fn()} onRunCritique={vi.fn()} onApprove={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Approved implementation plan" })).toBeInTheDocument();
    expect(screen.getByText("1. Bound cache")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save new plan version" })).not.toBeInTheDocument();
  });
});
