import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KnowledgeCardDialog, type KnowledgeCardDialogProps } from "./KnowledgeCardDialog";

function props(overrides: Partial<KnowledgeCardDialogProps> = {}): KnowledgeCardDialogProps {
  return { body: "", error: null, kind: "decision", loading: false, title: "",
    onChangeBody: vi.fn(), onChangeKind: vi.fn(), onChangeTitle: vi.fn(), onClose: vi.fn(),
    onCreate: vi.fn(), ...overrides };
}
describe("knowledge card dialog", () => {
  it("renders all kinds and forwards controlled field changes", () => {
    const value = props(); render(<KnowledgeCardDialog {...value} />);
    expect(screen.getAllByRole("option")).toHaveLength(5);
    fireEvent.change(screen.getByLabelText("Knowledge title"), { target: { value: "Rule" } });
    fireEvent.change(screen.getByLabelText("Knowledge kind"), { target: { value: "constraint" } });
    fireEvent.change(screen.getByLabelText("Knowledge body"), { target: { value: "Run tests" } });
    expect(value.onChangeTitle).toHaveBeenCalledWith("Rule");
    expect(value.onChangeKind).toHaveBeenCalledWith("constraint");
    expect(value.onChangeBody).toHaveBeenCalledWith("Run tests");
  });

  it("requires trimmed title and body and forwards create", () => {
    const value = props({ title: "Rule", body: "Run tests" });
    const { rerender } = render(<KnowledgeCardDialog {...value} />);
    fireEvent.click(screen.getByRole("button", { name: "Create Card" }));
    expect(value.onCreate).toHaveBeenCalledOnce();
    rerender(<KnowledgeCardDialog {...value} title="   " />);
    expect(screen.getByRole("button", { name: "Create Card" })).toBeDisabled();
    rerender(<KnowledgeCardDialog {...value} body="   " />);
    expect(screen.getByRole("button", { name: "Create Card" })).toBeDisabled();
  });

  it("renders errors and forwards every close route", () => {
    const value = props({ error: "Create failed" });
    const { container } = render(<KnowledgeCardDialog {...value} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Create failed");
    fireEvent.click(screen.getByRole("button", { name: "Close knowledge card dialog" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.mouseDown(container.querySelector(".modal-backdrop")!);
    expect(value.onClose).toHaveBeenCalledTimes(3);
  });

  it("locks explicit actions while loading but delegates backdrop close", () => {
    const value = props({ loading: true, title: "Rule", body: "Run tests" });
    const { container } = render(<KnowledgeCardDialog {...value} />);
    expect(screen.getByRole("button", { name: "Close knowledge card dialog" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create Card" })).toBeDisabled();
    fireEvent.mouseDown(container.querySelector(".modal-backdrop")!);
    expect(value.onClose).toHaveBeenCalledOnce();
  });
});
