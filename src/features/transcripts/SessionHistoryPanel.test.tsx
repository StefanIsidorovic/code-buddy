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
    selectedSessionId: null, sessions: [], onChangeFilter: vi.fn(), onChangeRenameTitle: vi.fn(),
    onOpen: vi.fn(), onRefresh: vi.fn(), onRename: vi.fn(), ...overrides };
}
describe("session history panel", () => {
  it("renders a collapsed filtered/total summary and caps visible rows at three", () => {
    const { container } = render(<SessionHistoryPanel {...props({ sessions, filter: "Task" })} />);
    expect(container.querySelector("details")).not.toHaveAttribute("open");
    expect(screen.getByText("4/4 saved")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Open Task/ })).toHaveLength(3);
  });
  it("renders empty, no-match, and error states", () => {
    const { rerender } = render(<SessionHistoryPanel {...props({ error: "offline" })} />);
    expect(screen.getByText("No saved sessions yet.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("offline");
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
    expect(value.onChangeFilter).toHaveBeenCalledWith("Codex");
    expect(value.onChangeRenameTitle).toHaveBeenCalledWith("Next");
    expect(value.onRefresh).toHaveBeenCalledOnce();
    expect(value.onOpen).toHaveBeenCalledWith(sessions[0]);
    expect(value.onRename).toHaveBeenCalledOnce();
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
  });
});
