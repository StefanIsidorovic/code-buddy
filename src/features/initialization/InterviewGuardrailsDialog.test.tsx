import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectRepositoryInfo } from "../../types/domain";
import {
  InterviewGuardrailsDialog,
  type InterviewGuardrailsDialogProps,
} from "./InterviewGuardrailsDialog";

const repositories: ProjectRepositoryInfo[] = [
  { id: "r1", projectId: "p1", name: "core", path: "/core", isDefault: true,
    createdAt: 1, updatedAt: 1 },
];

function props(overrides: Partial<InterviewGuardrailsDialogProps> = {}): InterviewGuardrailsDialogProps {
  return { content: "", drafts: [], error: null, kind: "fragile", loading: false,
    pathPattern: "", repositories, repositoryId: "r1", scope: "project", onAdd: vi.fn(),
    onChangeContent: vi.fn(), onChangeKind: vi.fn(), onChangePathPattern: vi.fn(),
    onChangeRepositoryId: vi.fn(), onChangeScope: vi.fn(), onClose: vi.fn(),
    onRemove: vi.fn(), onSave: vi.fn(), ...overrides };
}

describe("interview guardrails dialog", () => {
  it("forwards all controlled field and add callbacks", () => {
    const value = props(); render(<InterviewGuardrailsDialog {...value} />);
    expect(screen.queryByLabelText("Guardrail repository")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Guardrail scope"), { target: { value: "repository" } });
    fireEvent.change(screen.getByLabelText("Guardrail type"), { target: { value: "agent_rule" } });
    fireEvent.change(screen.getByLabelText("Guardrail path pattern"), { target: { value: "src/**" } });
    fireEvent.change(screen.getByLabelText("Guardrail content"), { target: { value: "Ask first" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Guardrail" }));
    expect(value.onChangeScope).toHaveBeenCalledWith("repository");
    expect(value.onChangeKind).toHaveBeenCalledWith("agent_rule");
    expect(value.onChangePathPattern).toHaveBeenCalledWith("src/**");
    expect(value.onChangeContent).toHaveBeenCalledWith("Ask first");
    expect(value.onAdd).toHaveBeenCalledOnce();
  });

  it("renders repository drafts and forwards repository/remove actions", () => {
    const value = props({ scope: "repository", drafts: [
      { repositoryId: "r1", kind: "do_not_touch", pathPattern: "gen/**", content: "Generated" },
      { repositoryId: "missing", kind: "requires_review", pathPattern: null, content: "Review" },
    ] });
    render(<InterviewGuardrailsDialog {...value} />);
    fireEvent.change(screen.getByLabelText("Guardrail repository"), { target: { value: "r1" } });
    const draftList = within(screen.getByRole("list", { name: "Draft interview guardrails" }));
    expect(draftList.getByText("Do not touch")).toBeInTheDocument();
    expect(draftList.getByText("Repository")).toBeInTheDocument();
    expect(draftList.getByText("gen/**")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[1]);
    expect(value.onChangeRepositoryId).toHaveBeenCalledWith("r1");
    expect(value.onRemove).toHaveBeenCalledWith(1);
  });

  it("keeps empty and loading action rules unchanged", () => {
    const { rerender } = render(<InterviewGuardrailsDialog {...props()} />);
    expect(screen.getByText("No guardrails yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Interview" })).toBeDisabled();
    rerender(<InterviewGuardrailsDialog {...props({ loading: true, drafts: [
      { repositoryId: null, kind: "fragile", pathPattern: null, content: "Careful" },
    ] })} />);
    expect(screen.getByRole("button", { name: "Close interview guardrails" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save Interview" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add Guardrail" })).toBeEnabled();
  });

  it("renders errors and forwards save, close, and backdrop actions", () => {
    const value = props({ error: "Save failed", drafts: [
      { repositoryId: null, kind: "fragile", pathPattern: null, content: "Careful" },
    ] });
    const { container } = render(<InterviewGuardrailsDialog {...value} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Save failed");
    fireEvent.click(screen.getByRole("button", { name: "Save Interview" }));
    fireEvent.click(screen.getByRole("button", { name: "Close interview guardrails" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.mouseDown(container.querySelector(".modal-backdrop")!);
    expect(value.onSave).toHaveBeenCalledOnce();
    expect(value.onClose).toHaveBeenCalledTimes(3);
  });
});
