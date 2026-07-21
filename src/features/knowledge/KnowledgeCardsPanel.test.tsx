import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { KnowledgeItemInfo } from "../../types/domain";
import { KnowledgeCardsPanel, type KnowledgeCardsPanelProps } from "./KnowledgeCardsPanel";

const items: KnowledgeItemInfo[] = [
  { id: "k1", projectId: "p1", title: "Rule", body: "Run tests", kind: "constraint",
    scope: "project", sourceTranscriptSessionId: null, createdAt: 1, updatedAt: 1 },
  { id: "k2", projectId: null, title: "Preference", body: "Be concise", kind: "preference",
    scope: "global", sourceTranscriptSessionId: null, createdAt: 1, updatedAt: 1 },
];
function props(overrides: Partial<KnowledgeCardsPanelProps> = {}): KnowledgeCardsPanelProps {
  return { attachedCount: 0, attachedIds: [], error: null, items: [], loading: false,
    onAdd: vi.fn(), onToggle: vi.fn(), ...overrides };
}
describe("knowledge cards panel", () => {
  it("renders a default-collapsed summary with attached count", () => {
    const { container } = render(<KnowledgeCardsPanel {...props({ attachedCount: 2 })} />);
    expect(container.querySelector("details")).not.toHaveAttribute("open");
    expect(screen.getByText("2 attached")).toBeInTheDocument();
  });
  it("renders empty/error state and forwards add", () => {
    const value = props({ error: "Load failed" }); render(<KnowledgeCardsPanel {...value} />);
    expect(screen.getByText("No knowledge cards yet.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Load failed");
    fireEvent.click(screen.getByRole("button", { name: "Add knowledge card" }));
    expect(value.onAdd).toHaveBeenCalledOnce();
  });
  it("renders card metadata/body and forwards attach and detach", () => {
    const value = props({ items, attachedIds: ["k1"], attachedCount: 1 });
    render(<KnowledgeCardsPanel {...value} />);
    expect(screen.getByText("constraint · project · project")).toBeInTheDocument();
    expect(screen.getByText("preference · global · global")).toBeInTheDocument();
    expect(screen.getByText("Run tests")).toBeInTheDocument();
    const checks = screen.getAllByRole("checkbox");
    expect(checks[0]).toBeChecked();
    fireEvent.click(checks[0]); fireEvent.click(checks[1]);
    expect(value.onToggle).toHaveBeenNthCalledWith(1, items[0], false);
    expect(value.onToggle).toHaveBeenNthCalledWith(2, items[1], true);
  });
  it("locks add while loading", () => {
    render(<KnowledgeCardsPanel {...props({ loading: true })} />);
    expect(screen.getByRole("button", { name: "Add knowledge card" })).toBeDisabled();
  });
});
