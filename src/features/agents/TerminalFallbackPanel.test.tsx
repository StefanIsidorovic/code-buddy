import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AgentDoctorReport } from "../../types/domain";
import { TerminalFallbackPanel, type TerminalFallbackPanelProps } from "./TerminalFallbackPanel";

const reports: AgentDoctorReport[] = [
  { adapter: { id: "codex", displayName: "Codex", executable: "codex",
    transports: { pty: "supported", acpStdio: "supported" } }, status: "installed",
    path: "/bin/codex", version: "1.0", error: null, installHint: "Install Codex" },
  { adapter: { id: "claude", displayName: "Claude", executable: "claude",
    transports: { pty: "supported", acpStdio: "unknown" } }, status: "missing",
    path: null, version: null, error: null, installHint: "Install Claude" },
  { adapter: { id: "kimi", displayName: "Kimi", executable: "kimi",
    transports: { pty: "unsupported", acpStdio: "unknown" } }, status: "error",
    path: null, version: null, error: "broken", installHint: "Install Kimi" },
];
function props(overrides: Partial<TerminalFallbackPanelProps> = {}): TerminalFallbackPanelProps {
  return { error: null, loading: false, reports: [], runtimeMode: "acp", sessionLocked: false,
    onRefresh: vi.fn(), onToggleMode: vi.fn(), ...overrides };
}
describe("terminal fallback panel", () => {
  it("renders default-collapsed fallback and active mode summaries", () => {
    const { container, rerender } = render(<TerminalFallbackPanel {...props()} />);
    expect(container.querySelector("details")).not.toHaveAttribute("open");
    expect(screen.getByText("fallback")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open PTY" })).toBeInTheDocument();
    rerender(<TerminalFallbackPanel {...props({ runtimeMode: "pty" })} />);
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use ACP" })).toBeInTheDocument();
  });
  it("renders installed, missing, error, and transport details", () => {
    render(<TerminalFallbackPanel {...props({ reports })} />);
    expect(screen.getByText("Installed")).toBeInTheDocument();
    expect(screen.getByText("1.0")).toBeInTheDocument();
    expect(screen.getByText("Install Claude")).toBeInTheDocument();
    expect(screen.getByText("broken")).toBeInTheDocument();
    expect(screen.getByText("PTY: Supported · ACP: Supported")).toBeInTheDocument();
    expect(screen.getByText("PTY: Unsupported · ACP: Unknown")).toBeInTheDocument();
  });
  it("forwards refresh and mode toggle", () => {
    const value = props(); render(<TerminalFallbackPanel {...value} />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "Open PTY" }));
    expect(value.onRefresh).toHaveBeenCalledOnce();
    expect(value.onToggleMode).toHaveBeenCalledOnce();
  });
  it("renders errors and preserves loading and session locks", () => {
    render(<TerminalFallbackPanel {...props({ error: "offline", loading: true, sessionLocked: true })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("offline");
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Open PTY" })).toBeDisabled();
  });
});
