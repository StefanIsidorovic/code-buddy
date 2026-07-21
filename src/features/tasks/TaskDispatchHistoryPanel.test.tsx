import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskContextDispatchReceiptInfo } from "../../types/domain";
import { TaskDispatchHistoryPanel } from "./TaskDispatchHistoryPanel";

const receipt: TaskContextDispatchReceiptInfo = { id: "r1", taskId: "t1", transcriptSessionId: "s1",
  sequence: 0, acpSessionId: "acp1", userPrompt: "Continue", renderedContext: "- Evidence",
  wirePrompt: "wire", sources: [{ sourceId: "a1", sourceType: "task_artifact",
    reason: "task_phase_artifact", score: 1500 }], status: "pending", stopReason: null,
  error: null, createdAt: 1_785_000_000, updatedAt: 1_785_000_000 };
function props(overrides = {}) { return { receipts: [receipt], loading: false, error: null,
  resolutionReceiptId: null, resolutionReason: "", onRefresh: vi.fn(), onOpenResolution: vi.fn(),
  onChangeResolutionReason: vi.fn(), onCancelResolution: vi.fn(), onResolve: vi.fn(), ...overrides }; }

describe("TaskDispatchHistoryPanel", () => {
  it("renders receipt status, source count, and exact context", () => {
    render(<TaskDispatchHistoryPanel {...props()} />);
    expect(screen.getByRole("heading", { name: "Context dispatch history" })).toBeInTheDocument();
    expect(screen.getByText("#1 · pending")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Exact dispatched context"));
    expect(screen.getByText("- Evidence")).toBeInTheDocument();
  });
  it("requires an explicit reason before resolving pending as failed", () => {
    const value = props({ resolutionReceiptId: "r1" });
    const view = render(<TaskDispatchHistoryPanel {...value} />);
    expect(screen.getByRole("button", { name: "Mark as failed" })).toBeDisabled();
    view.rerender(<TaskDispatchHistoryPanel {...props({ resolutionReceiptId: "r1",
      resolutionReason: "No result after restart", onResolve: value.onResolve })} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark as failed" }));
    expect(value.onResolve).toHaveBeenCalledOnce();
    expect(screen.getByText(/Stop the associated ACP session first/i)).toBeInTheDocument();
  });
  it("never offers resolution for finalized receipts and exposes refresh/error states", () => {
    const value = props({ receipts: [{ ...receipt, status: "sent", stopReason: "end_turn" }],
      error: "offline" }); render(<TaskDispatchHistoryPanel {...value} />);
    expect(screen.queryByRole("button", { name: "Resolve pending receipt" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("offline");
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(value.onRefresh).toHaveBeenCalledOnce();
  });
});
