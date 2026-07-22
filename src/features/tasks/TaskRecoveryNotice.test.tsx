import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskContextDispatchReceiptInfo, TaskPhaseRunReceiptInfo } from "../../types/domain";
import { interruptedReceipts, TaskRecoveryNotice } from "./TaskRecoveryNotice";

const phase = { id: "phase-old", sequence: 1, status: "pending", acpSessionId: "old-acp" } as TaskPhaseRunReceiptInfo;
const context = { id: "context-old", sequence: 2, status: "pending",
  acpSessionId: "old-acp" } as TaskContextDispatchReceiptInfo;

describe("TaskRecoveryNotice", () => {
  it("distinguishes interrupted receipts from current-session and finalized work", () => {
    expect(interruptedReceipts([
      phase, { ...phase, id: "live", acpSessionId: "current-acp" },
      { ...phase, id: "sent", status: "sent" },
    ], "current-acp").map(({ id }) => id)).toEqual(["phase-old"]);
    expect(interruptedReceipts([phase], null)).toEqual([phase]);
  });

  it("explains uncertainty and opens the exact existing resolution forms", () => {
    const onReviewPhase = vi.fn(); const onReviewContext = vi.fn();
    render(<TaskRecoveryNotice phaseReceipts={[phase]} contextReceipts={[context]}
      currentAcpSessionId="current-acp" onReviewPhase={onReviewPhase} onReviewContext={onReviewContext} />);
    expect(screen.getByRole("status")).toHaveTextContent("does not prove");
    fireEvent.click(screen.getByRole("button", { name: "Review phase run #2" }));
    fireEvent.click(screen.getByRole("button", { name: "Review context send #3" }));
    expect(onReviewPhase).toHaveBeenCalledWith("phase-old");
    expect(onReviewContext).toHaveBeenCalledWith("context-old");
  });

  it("renders nothing when pending work belongs to the current live session", () => {
    const { container } = render(<TaskRecoveryNotice phaseReceipts={[phase]} contextReceipts={[]}
      currentAcpSessionId="old-acp" onReviewPhase={vi.fn()} onReviewContext={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
