import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UnifiedTaskContextSelectionInfo } from "../../types/domain";
import { TaskContextPreviewDialog, type TaskContextPreviewDialogProps } from "./TaskContextPreviewDialog";

const source = { id: "u1", sourceType: "project_knowledge" as const, kind: "agent_rule",
  title: "testing", content: "Run tests" };
const preview: UnifiedTaskContextSelectionInfo = { initializationId: "i1", characterBudget: 6000,
  usedCharacters: 120, remainingCharacters: 5880, renderedContext: "- Run tests",
  included: [{ source, score: 130, reason: "mandatory_rule", characterCount: 120 }],
  excluded: [{ source: { ...source, id: "u2", kind: "project_fact", content: "Rust" }, score: 0,
    reason: "not_relevant", characterCount: 40 }] };
function props(overrides: Partial<TaskContextPreviewDialogProps> = {}): TaskContextPreviewDialogProps {
  return { error: null, loading: false, sending: false, canSend: true, preview: null,
    onClose: vi.fn(), onSend: vi.fn(), ...overrides };
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
    expect(screen.getByText(/original prompt stays unchanged/i)).toBeInTheDocument();
  });

  it("renders the no-match notice and forwards button/backdrop close", () => {
    const value = props({ preview: { ...preview, included: [] } });
    const { container } = render(<TaskContextPreviewDialog {...value} />);
    expect(screen.getByText("No units matched this task")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close task context preview" }));
    fireEvent.mouseDown(container.querySelector(".modal-backdrop")!);
    expect(value.onClose).toHaveBeenCalledTimes(2);
  });

  it("sends only an available preview and locks every exit while sending", () => {
    const value = props({ preview });
    const { container, rerender } = render(<TaskContextPreviewDialog {...value} />);
    fireEvent.click(screen.getByRole("button", { name: "Send with this context" }));
    expect(value.onSend).toHaveBeenCalledOnce();
    rerender(<TaskContextPreviewDialog {...props({ preview, sending: true, onClose: value.onClose })} />);
    expect(screen.getByRole("button", { name: "Sending context…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.mouseDown(container.querySelector(".modal-backdrop")!);
    expect(value.onClose).not.toHaveBeenCalled();
  });

  it("disables sending when ACP is unavailable or rendered context is empty", () => {
    const { rerender } = render(<TaskContextPreviewDialog {...props({ preview, canSend: false })} />);
    expect(screen.getByRole("button", { name: "Send with this context" })).toBeDisabled();
    rerender(<TaskContextPreviewDialog {...props({ preview: { ...preview, renderedContext: " " } })} />);
    expect(screen.getByRole("button", { name: "Send with this context" })).toBeDisabled();
  });
});
