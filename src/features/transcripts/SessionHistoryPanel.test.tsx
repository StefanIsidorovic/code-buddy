import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TranscriptSessionInfo } from "../../types/domain";
import { SessionHistoryPanel, type SessionHistoryPanelProps } from "./SessionHistoryPanel";

const sessions: TranscriptSessionInfo[] = Array.from({ length: 4 }, (_, index) => ({
  id: `session-${index}-abcdefgh`, projectId: "p1", runtime: "acp", source: "Codex",
  title: `Task ${index}`, startedAt: 1, updatedAt: index + 1, eventCount: index + 2,
}));
function props(overrides: Partial<SessionHistoryPanelProps> = {}): SessionHistoryPanelProps {
  return { activeSessionTitle: null, error: null, filter: "", loading: false, renameTitle: "",
    resumeDisabled: false, resumeDisabledReason: null, resumeError: null, resumingSessionId: null,
    selectedSessionId: null, sessions: [], onChangeFilter: vi.fn(), onChangeRenameTitle: vi.fn(),
    onOpen: vi.fn(), onRefresh: vi.fn(), onRename: vi.fn(), onResume: vi.fn(), ...overrides };
}
describe("session history panel", () => {
  it("renders a collapsed filtered/total summary and caps visible rows at three", () => {
    const { container } = render(<SessionHistoryPanel {...props({ sessions, filter: "Task" })} />);
    expect(container.querySelector("details")).not.toHaveAttribute("open");
    expect(screen.getByText("4/4 saved")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Open Task/ })).toHaveLength(3);
  });
  it("renders empty, no-match, and error states", () => {
    const { rerender } = render(<SessionHistoryPanel {...props({ error: "offline",
      resumeError: "legacy transcript" })} />);
    expect(screen.getByText("No saved sessions yet.")).toBeInTheDocument();
    expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toEqual([
      "offline", "legacy transcript",
    ]);
    rerender(<SessionHistoryPanel {...props({ sessions, filter: "missing" })} />);
    expect(screen.getByText("No sessions match this filter.")).toBeInTheDocument();
  });
  it("forwards filter, refresh, open, and selected rename actions", () => {
    const value = props({ sessions, selectedSessionId: sessions[0].id,
      renameTitle: "Renamed", activeSessionTitle: "Live" });
    render(<SessionHistoryPanel {...value} />);
    fireEvent.change(screen.getByLabelText("Filter session history"), { target: { value: "Codex" } });
    fireEvent.change(screen.getByLabelText("Selected session name"), { target: { value: "Next" } });
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Task 0 transcript" }));
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.click(screen.getByRole("button", { name: "Resume Task 0 session" }));
    expect(value.onChangeFilter).toHaveBeenCalledWith("Codex");
    expect(value.onChangeRenameTitle).toHaveBeenCalledWith("Next");
    expect(value.onRefresh).toHaveBeenCalledOnce();
    expect(value.onOpen).toHaveBeenCalledWith(sessions[0]);
    expect(value.onRename).toHaveBeenCalledOnce();
    expect(value.onResume).toHaveBeenCalledWith(sessions[0]);
  });
  it("enforces rename validation and loading locks", () => {
    const { rerender } = render(<SessionHistoryPanel {...props({ sessions,
      selectedSessionId: sessions[0].id, renameTitle: sessions[0].title })} />);
    expect(screen.getByRole("button", { name: "Rename" })).toBeDisabled();
    rerender(<SessionHistoryPanel {...props({ sessions, selectedSessionId: sessions[0].id,
      renameTitle: "Next", loading: true })} />);
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Rename" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /Open Task/ })[0]).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /Resume Task/ })[0]).toBeDisabled();
  });
  it("locks every Resume action while one row is resuming or an ACP session is active", () => {
    const { rerender } = render(<SessionHistoryPanel {...props({ sessions,
      resumingSessionId: sessions[1].id })} />);
    expect(screen.getByRole("button", { name: "Resume Task 1 session" })).toHaveTextContent("Resuming…");
    expect(screen.getAllByRole("button", { name: /Resume Task/ })
      .every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    rerender(<SessionHistoryPanel {...props({ sessions, resumeDisabled: true,
      resumeDisabledReason: "Stop the running ACP session before resuming saved history." })} />);
    expect(screen.getByText("Stop the running ACP session before resuming saved history."))
      .toHaveClass("history-resume-message");
    expect(screen.getAllByRole("button", { name: /Resume Task/ })[0]).toHaveTextContent("Locked");
  });
});
