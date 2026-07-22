import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GitDeliveryReadinessInfo } from "../../types/domain";
import { DeliveryReadinessPanel } from "./DeliveryReadinessPanel";

const readiness: GitDeliveryReadinessInfo = {
  repositoryPath: "/repo",
  branch: "new/start",
  headSha: "abc123",
  headSubject: "step 28.1: inspect readiness",
  worktreeClean: true,
  changedFileCount: 0,
  changedFiles: [],
  headProvenance: {
    present: true,
    refName: "refs/notes/provenance",
    planStepId: "28.1",
    notePreview: "{\"plan_step_id\":\"28.1\"}",
  },
};

describe("DeliveryReadinessPanel", () => {
  it("renders clean worktree and provenance readiness without offering mutation actions", () => {
    const onRefresh = vi.fn();
    render(<DeliveryReadinessPanel repositoryPath="/repo" readiness={readiness}
      loading={false} error={null} onRefresh={onRefresh} />);
    expect(screen.getByRole("heading", { name: "Delivery readiness" })).toBeInTheDocument();
    expect(screen.getByText("Ready for delivery review")).toBeInTheDocument();
    expect(screen.getByText("Present · step 28.1")).toBeInTheDocument();
    expect(screen.getByText(/No Git command here mutates files or refs/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ship|commit|push/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("shows dirty changed files and missing provenance", () => {
    render(<DeliveryReadinessPanel repositoryPath="/repo" loading={false} error={null}
      onRefresh={vi.fn()} readiness={{ ...readiness, worktreeClean: false, changedFileCount: 2,
        changedFiles: [{ status: "M", path: "src/App.tsx" }, { status: "??", path: "TODO.md" }],
        headProvenance: { present: false, refName: "refs/notes/provenance",
          planStepId: null, notePreview: null } }} />);
    expect(screen.getByText("Not ready yet")).toBeInTheDocument();
    expect(screen.getAllByText("2 changed file(s)")).toHaveLength(2);
    fireEvent.click(screen.getByText("Changed files"));
    expect(screen.getByText("src/App.tsx")).toBeInTheDocument();
    expect(screen.getByText("Missing refs/notes/provenance")).toBeInTheDocument();
  });

  it("renders repository, loading, and error states", () => {
    const { rerender } = render(<DeliveryReadinessPanel repositoryPath={null} readiness={null}
      loading={false} error={null} onRefresh={vi.fn()} />);
    expect(screen.getByText("Select a repository to inspect Git readiness.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    rerender(<DeliveryReadinessPanel repositoryPath="/repo" readiness={null}
      loading error="git failed" onRefresh={vi.fn()} />);
    expect(screen.getByText("Loading delivery readiness…")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("git failed");
  });
});
