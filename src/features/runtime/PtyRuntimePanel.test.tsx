import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PtyRuntimePanel, type PtyRuntimePanelProps } from "./PtyRuntimePanel";

function props(overrides: Partial<PtyRuntimePanelProps> = {}): PtyRuntimePanelProps {
  return {
    busy: false,
    canStartCodex: true,
    hasSession: false,
    sessionUsable: false,
    statusLabel: "idle",
    terminalSize: { cols: 80, rows: 24 },
    onDrain: vi.fn(),
    onResize: vi.fn(),
    onStartCodex: vi.fn(),
    onStartFake: vi.fn(),
    onStop: vi.fn(),
    onUseAcp: vi.fn(),
    ...overrides,
  };
}

describe("PTY runtime panel", () => {
  it("renders idle status and terminal dimensions", () => {
    render(<PtyRuntimePanel {...props({ terminalSize: { cols: 132, rows: 43 } })} />);
    expect(screen.getByRole("heading", { name: "PTY Controls" })).toBeInTheDocument();
    expect(screen.getByText("idle")).toBeInTheDocument();
    expect(screen.getByText("132x43")).toBeInTheDocument();
  });

  it("forwards mode and start actions", () => {
    const value = props();
    render(<PtyRuntimePanel {...value} />);
    fireEvent.click(screen.getByRole("button", { name: "Use ACP" }));
    fireEvent.click(screen.getByRole("button", { name: "Start Fake" }));
    fireEvent.click(screen.getByRole("button", { name: "Start Codex" }));
    expect(value.onUseAcp).toHaveBeenCalledOnce();
    expect(value.onStartFake).toHaveBeenCalledOnce();
    expect(value.onStartCodex).toHaveBeenCalledOnce();
  });

  it("enables live-session actions and preserves graceful/force stop semantics", () => {
    const value = props({ hasSession: true, sessionUsable: true });
    render(<PtyRuntimePanel {...value} />);
    fireEvent.click(screen.getByRole("button", { name: "Drain" }));
    fireEvent.click(screen.getByRole("button", { name: "Resize" }));
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    fireEvent.click(screen.getByRole("button", { name: "Kill" }));
    expect(value.onDrain).toHaveBeenCalledOnce();
    expect(value.onResize).toHaveBeenCalledOnce();
    expect(value.onStop).toHaveBeenNthCalledWith(1, false);
    expect(value.onStop).toHaveBeenNthCalledWith(2, true);
  });

  it("locks actions for busy, active-session, and unavailable-Codex states", () => {
    const { rerender } = render(<PtyRuntimePanel {...props({ canStartCodex: false })} />);
    expect(screen.getByRole("button", { name: "Start Codex" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Drain" })).toBeDisabled();
    rerender(<PtyRuntimePanel {...props({ busy: true, hasSession: true, sessionUsable: true })} />);
    for (const name of ["Use ACP", "Start Fake", "Start Codex", "Drain", "Resize", "Stop", "Kill"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });
});
