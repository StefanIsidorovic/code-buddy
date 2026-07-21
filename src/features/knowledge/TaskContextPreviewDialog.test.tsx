import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { KnowledgeUnitInfo, TaskContextSelectionInfo } from "../../types/domain";
import { TaskContextPreviewDialog, type TaskContextPreviewDialogProps } from "./TaskContextPreviewDialog";

const unit: KnowledgeUnitInfo = { id: "u1", projectId: "p1", initializationId: "i1",
  derivedFromSummaryId: "s1", kind: "agent_rule", topic: "testing", content: "Run tests",
  scope: "project", status: "active", confidence: 90, schemaVersion: 1, sources: [], createdAt: 1 };
const preview: TaskContextSelectionInfo = { initializationId: "i1", characterBudget: 6000,
  usedCharacters: 120, remainingCharacters: 5880, renderedContext: "- Run tests",
  included: [{ unit, score: 130, reason: "mandatory_rule", characterCount: 120 }],
  excluded: [{ unit: { ...unit, id: "u2", kind: "project_fact", content: "Rust" }, score: 0,
    reason: "not_relevant", characterCount: 40 }] };
function props(overrides: Partial<TaskContextPreviewDialogProps> = {}): TaskContextPreviewDialogProps {
  return { error: null, loading: false, preview: null, onClose: vi.fn(), ...overrides };
}

describe("task context preview dialog", () => {
  it("renders loading first and blocks every close route", () => {
    const value = props({ loading: true, error: "ignored", preview });
    const { container } = render(<TaskContextPreviewDialog {...value} />);
    expect(screen.getByText("Selecting minimal task context…")).toBeInTheDocument();
    expect(screen.queryByText("Task context could not be selected")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close task context preview" })).toBeDisabled();
    fireEvent.mouseDown(container.querySelector(".modal-backdrop")!);
    expect(value.onClose).not.toHaveBeenCalled();
  });

  it("renders error before no-preview and otherwise renders the empty state", () => {
    const { rerender } = render(<TaskContextPreviewDialog {...props({ error: "offline" })} />);
    expect(screen.getByText("Task context could not be selected")).toBeInTheDocument();
    expect(screen.getByText("offline")).toBeInTheDocument();
    rerender(<TaskContextPreviewDialog {...props()} />);
    expect(screen.getByText("No preview available")).toBeInTheDocument();
  });

  it("renders exact budget, included/excluded entries, reasons, and read-only context", () => {
    render(<TaskContextPreviewDialog {...props({ preview })} />);
    expect(screen.getByText("Included · 1")).toBeInTheDocument();
    expect(screen.getByText("mandatory rule · score 130")).toBeInTheDocument();
    expect(screen.getByText("Excluded · 1")).toBeInTheDocument();
    expect(screen.getByText("not relevant")).toBeInTheDocument();
    expect(screen.getByDisplayValue("- Run tests")).toHaveAttribute("readonly");
    expect(screen.getByText("5880")).toBeInTheDocument();
  });

  it("renders the no-match notice and forwards button/backdrop close", () => {
    const value = props({ preview: { ...preview, included: [] } });
    const { container } = render(<TaskContextPreviewDialog {...value} />);
    expect(screen.getByText("No units matched this task")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close task context preview" }));
    fireEvent.mouseDown(container.querySelector(".modal-backdrop")!);
    expect(value.onClose).toHaveBeenCalledTimes(2);
  });
});
