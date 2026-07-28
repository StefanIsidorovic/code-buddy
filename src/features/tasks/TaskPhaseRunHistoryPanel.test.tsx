import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskPhaseRunReceiptInfo } from "../../types/domain";
import { TaskPhaseRunHistoryPanel } from "./TaskPhaseRunHistoryPanel";
const receipt: TaskPhaseRunReceiptInfo = { id: "r1", taskId: "t1", transcriptSessionId: "s1", sequence: 0,
  phase: "analysis", acpSessionId: "acp1", instruction: "Analyze only", status: "pending",
  stopReason: null, error: null, verificationStatus: null, verificationWorkspacePath: null,
  verificationChangedFilesJson: null, verificationError: null,
  createdAt: 1_785_000_000, updatedAt: 1_785_000_000 };
function props(overrides = {}) { return { receipts: [receipt], loading: false, error: null,
  resolutionReceiptId: null, resolutionReason: "", onRefresh: vi.fn(), onOpenResolution: vi.fn(),
  onChangeResolutionReason: vi.fn(), onCancelResolution: vi.fn(), onResolve: vi.fn(), ...overrides }; }
describe("TaskPhaseRunHistoryPanel", () => {
  it("shows phase status and exact instruction", () => { render(<TaskPhaseRunHistoryPanel {...props()} />);
    expect(screen.getByRole("heading", { name: "Phase run history" })).toBeInTheDocument();
    expect(screen.getByText("#1 · analysis · pending")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Exact phase instruction")); expect(screen.getByText("Analyze only")).toBeInTheDocument(); });
  it("requires a reason and never resolves finalized runs", () => {
    const view = render(<TaskPhaseRunHistoryPanel {...props({ resolutionReceiptId: "r1" })} />);
    expect(screen.getByRole("button", { name: "Mark as failed" })).toBeDisabled();
    view.rerender(<TaskPhaseRunHistoryPanel {...props({ receipts: [{ ...receipt, status: "sent" }], error: "offline" })} />);
    expect(screen.queryByRole("button", { name: "Resolve pending run" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("offline");
  });
});
