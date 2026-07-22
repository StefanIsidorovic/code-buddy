import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getByText("Check the API boundary.")).toBeInTheDocument();
    expect(screen.getByText(/advisor-transcript · 2 provenance/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run advisor" }));
    expect(onRun).toHaveBeenCalledWith("advisor");
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledOnce();
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
