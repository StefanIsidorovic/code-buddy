import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskAgentReportInfo } from "../../types/domain";
import { TaskAgentReportsPanel } from "./TaskAgentReportsPanel";

const report = { id: "report-1", taskId: "task-1", phase: "analysis", sequence: 0,
  role: "advisor", transcriptSessionId: "advisor-transcript", content: "Check the API boundary.",
  sourceTranscriptEventIds: ["event-1", "event-2"], createdAt: 1_785_000_001 } satisfies TaskAgentReportInfo;

describe("TaskAgentReportsPanel", () => {
  it("shows immutable role, phase, content, and provenance identity", () => {
    const onRefresh = vi.fn();
    const onRun = vi.fn();
    render(<TaskAgentReportsPanel reports={[report]} loading={false} runningRole={null} error={null}
      runDisabledReason={null} onRun={onRun} onRefresh={onRefresh} />);
    expect(screen.getByRole("heading", { name: "Advisor & reviewer reports" })).toBeInTheDocument();
    expect(screen.getByText("#1 · advisor · analysis")).toBeInTheDocument();
    expect(screen.getAllByText("Check the API boundary.")).toHaveLength(2);
    expect(screen.getByText(/advisor-transcript · 2 provenance/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run advisor" }));
    expect(onRun).toHaveBeenCalledWith("advisor");
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("renders an actionable read-only review brief without hiding raw reports", () => {
    render(<TaskAgentReportsPanel reports={[report, { ...report, id: "report-2", sequence: 1,
      role: "reviewer", content: "Risk: missing rollback\n- Add recovery test",
      transcriptSessionId: "reviewer-transcript", sourceTranscriptEventIds: ["event-3"] }]} loading={false}
      runningRole={null} error={null} runDisabledReason={null} onRun={vi.fn()} onRefresh={vi.fn()} />);
    const brief = screen.getByRole("region", { name: "Review brief" });
    expect(within(brief).getByText(/Use them as review prompts, not saved evidence/)).toBeInTheDocument();
    expect(within(brief).getByText("Risk: missing rollback")).toBeInTheDocument();
    expect(within(brief).getByText("Add recovery test")).toBeInTheDocument();
    expect(within(brief).getAllByText((content) => content.includes("reviewer")
      && content.includes("transcript reviewer-transcript") && content.includes("1 provenance event"))).not.toHaveLength(0);
    expect(screen.getAllByText("Check the API boundary.")).toHaveLength(2);
    expect(screen.getByText("#2 · reviewer · analysis")).toBeInTheDocument();
  });

  it("renders loading, empty, and error states with the refresh lock", () => {
    const { rerender } = render(<TaskAgentReportsPanel reports={[]} loading runningRole={null}
      error={null} runDisabledReason="Select an ACP agent first." onRun={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText("Loading reports…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run advisor" })).toBeDisabled();
    rerender(<TaskAgentReportsPanel reports={[]} loading={false} runningRole="reviewer" error="offline"
      runDisabledReason={null} onRun={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("offline");
    expect(screen.getByRole("button", { name: "Running reviewer…" })).toBeDisabled();
    expect(screen.getByText("No secondary-agent reports yet.")).toBeInTheDocument();
  });
});
