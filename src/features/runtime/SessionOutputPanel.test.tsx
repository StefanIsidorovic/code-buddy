import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SessionOutputPanelProps } from "./SessionOutputPanel";
import { SessionOutputPanel } from "./SessionOutputPanel";

function props(overrides: Partial<SessionOutputPanelProps> = {}): SessionOutputPanelProps {
  return {
    events: [], eventsListRef: createRef<HTMLUListElement>(), openedTranscript: null,
    output: "", runtimeMode: "acp", showWaiting: false,
    terminalElementRef: createRef<HTMLDivElement>(), onFocusTerminal: vi.fn(),
    onShowLiveEvents: vi.fn(), ...overrides,
  };
}

describe("session output panel", () => {
  it("mounts and focuses the PTY surface with a screen-reader fallback", () => {
    const value = props({ runtimeMode: "pty", output: "terminal output" });
    render(<SessionOutputPanel {...value} />);
    fireEvent.click(screen.getByLabelText("Interactive PTY terminal"));
    expect(value.onFocusTerminal).toHaveBeenCalledOnce();
    expect(screen.getByText("terminal output")).toHaveClass("sr-only");
    expect(value.terminalElementRef.current).toBeInstanceOf(HTMLDivElement);
  });

  it("shows the live ACP empty state", () => {
    render(<SessionOutputPanel {...props()} />);
    expect(screen.getByText("No ACP events yet.")).toBeInTheDocument();
  });

  it("labels saved transcript messages and returns to live events", () => {
    const value = props({
      events: [{ kind: "user_message", content: "Question text" }, { kind: "agent_message", content: "Answer text" }],
      openedTranscript: { id: "abcdefgh-1234", projectId: "p1", runtime: "acp", source: "Codex",
        title: "Saved work", startedAt: 1, updatedAt: 2, eventCount: 2 },
    });
    render(<SessionOutputPanel {...value} />);
    expect(screen.getByText("Saved work · 2 events · abcdefgh")).toBeInTheDocument();
    expect(screen.getByText("Question")).toBeInTheDocument();
    expect(screen.getByText("Answer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View Live ACP" }));
    expect(value.onShowLiveEvents).toHaveBeenCalledOnce();
  });

  it("renders the pending row while the agent is working", () => {
    render(<SessionOutputPanel {...props({ showWaiting: true })} />);
    expect(screen.getByText("Agent is preparing a response")).toBeInTheDocument();
    expect(screen.getByText("Waiting").closest("li")).toHaveAttribute("data-kind", "pending");
  });
});
