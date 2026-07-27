import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AcpRegistryCandidate } from "../../types/domain";
import { AcpRegistryPanel, type AcpRegistryPanelProps } from "./AcpRegistryPanel";

const candidates: AcpRegistryCandidate[] = [
  { id: "codex", name: "Codex", version: "1", description: "OpenAI agent", distribution: "npx",
    status: "ready", command: ["npx", "codex acp"], runnerPath: "/bin/npx",
    installHint: "Ready", sourceUrl: "https://example.test" },
  { id: "claude", name: "Claude", version: "2", description: "Anthropic agent", distribution: "binary",
    status: "missing_runner", command: ["claude", "--acp"], runnerPath: null,
    installHint: "Install Claude", sourceUrl: "https://example.test" },
];
function props(overrides: Partial<AcpRegistryPanelProps> = {}): AcpRegistryPanelProps {
  return { busy: false, candidates: [], error: null, loading: false, selectedCandidateId: null,
    sessionLocked: false, onRefresh: vi.fn(), onSelect: vi.fn(), ...overrides };
}
describe("ACP registry panel", () => {
  function openModal() {
    fireEvent.click(screen.getByRole("button", { name: /ACP Agents/ }));
  }
  it("renders a compact trigger and opens the registry as a modal", () => {
    render(<AcpRegistryPanel {...props()} />);
    expect(screen.queryByRole("dialog", { name: "ACP Agents" })).not.toBeInTheDocument();
    expect(screen.getByText("None selected")).toBeInTheDocument();
    openModal();
    expect(screen.getByRole("dialog", { name: "ACP Agents" })).toBeInTheDocument();
  });
  it("renders statuses, metadata, formatted command, and selected summary", () => {
    render(<AcpRegistryPanel {...props({ candidates, selectedCandidateId: "codex" })} />);
    openModal();
    expect(screen.getByText("Ready", { selector: ".doctor-status" })).toBeInTheDocument();
    expect(screen.getByText("Missing runner")).toBeInTheDocument();
    expect(screen.getByText('npx "codex acp"').closest('[role="tooltip"]')).toBeInTheDocument();
    expect(screen.getByLabelText("Show Codex launch command")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Codex ACP candidate" })).toHaveAttribute("aria-pressed", "true");
  });
  it("forwards refresh and candidate selection", () => {
    const value = props({ candidates }); render(<AcpRegistryPanel {...value} />);
    openModal();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Claude ACP candidate" }));
    expect(value.onRefresh).toHaveBeenCalledOnce();
    expect(value.onSelect).toHaveBeenCalledWith("claude");
  });
  it("renders errors and preserves loading, busy, and session locks", () => {
    const { rerender } = render(<AcpRegistryPanel {...props({ candidates, error: "offline", loading: true })} />);
    openModal();
    expect(screen.getByRole("alert")).toHaveTextContent("offline");
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    rerender(<AcpRegistryPanel {...props({ candidates, busy: true })} />);
    expect(screen.getByRole("button", { name: "Select Codex ACP candidate" })).toBeDisabled();
    rerender(<AcpRegistryPanel {...props({ candidates, sessionLocked: true })} />);
    expect(screen.getByRole("button", { name: "Select Claude ACP candidate" })).toBeDisabled();
  });
});
