import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  KnowledgeUnitInfo, ProjectInitializationFactInfo,
  ProjectInitializationMarkdownFindingInfo, ProjectInitializationSummaryInfo,
} from "../../types/domain";
import {
  InitializationDetailsDialog, type InitializationDetailsDialogProps,
} from "./InitializationDetailsDialog";

const fact: ProjectInitializationFactInfo = { id: "f1", initializationId: "i1",
  repositoryId: "r1", repositoryName: "core", repositoryPath: "/core", kind: "runtime",
  label: "Language", value: "Rust", source: "Cargo.toml", createdAt: 1 };
const finding: ProjectInitializationMarkdownFindingInfo = { id: "m1", initializationId: "i1",
  repositoryId: "r1", repositoryName: "core", repositoryPath: "/core", filePath: "README.md",
  category: "build_rule", title: "Build", excerpt: "Run cargo test", source: "README.md:4", createdAt: 1 };
const summary: ProjectInitializationSummaryInfo = { id: "s1", initializationId: "i1",
  status: "draft", projectPurpose: "Agent workspace", repositoryMap: "core", repositoryRoles: "runtime",
  buildTestMatrix: "cargo test", fragileAreas: "storage", doNotTouchRules: "generated",
  agentWorkingRules: "review", openQuestions: "none", claims: [{ id: "c1", section: "project_purpose",
    claimIndex: 0, originalContent: "Agent workspace", content: "Agent workspace",
    status: "accepted", rejectionReason: null }], factCount: 1, markdownFindingCount: 1,
  guardrailCount: 1, requestedModelProfileId: "profile", requestedModelProviderId: "openai",
  requestedModelId: "gpt", requestedModelTier: "mid", requestedModelParameters: [],
  modelCatalogSchemaVersion: 1, knowledgeSchemaVersion: 1, generationEngine: "openai_responses_v1",
  createdAt: 1, approvedAt: null };
const unit: KnowledgeUnitInfo = { id: "u1", projectId: "p1", initializationId: "i1",
  derivedFromSummaryId: "s1", kind: "agent_rule", topic: "testing", content: "Run tests",
  scope: "project", status: "active", confidence: 90, schemaVersion: 1,
  sources: [{ sourceKey: "README.md:4", repositoryId: "r1", path: "README.md" }], createdAt: 1 };

function props(overrides: Partial<InitializationDetailsDialogProps> = {}): InitializationDetailsDialogProps {
  return { factGroups: [], initializeLoading: false, regeneratingSection: null,
    knowledgeUnits: [], knowledgeUnitsError: null,
    knowledgeUnitsLoading: false, markdownFindings: [], summary: null, view: "facts",
    onApproveSummary: vi.fn(), onReviewSummaryClaim: vi.fn(),
    onRegenerateSummarySection: vi.fn(), onClose: vi.fn(), ...overrides };
}

describe("initialization details dialog", () => {
  it("renders Facts details and their prerequisite state", () => {
    const { rerender } = render(<InitializationDetailsDialog {...props()} />);
    expect(screen.getByText("Facts have not been collected yet")).toBeInTheDocument();
    rerender(<InitializationDetailsDialog {...props({ factGroups: [
      { repositoryId: "r1", repositoryName: "core", facts: [fact] },
    ] })} />);
    expect(screen.getByText("Language: Rust")).toBeInTheDocument();
    expect(screen.getByText("1 facts")).toBeInTheDocument();
  });

  it("renders Markdown details and their prerequisite state", () => {
    const { rerender } = render(<InitializationDetailsDialog {...props({ view: "markdown" })} />);
    expect(screen.getByText("Markdown has not been analyzed yet")).toBeInTheDocument();
    rerender(<InitializationDetailsDialog {...props({ view: "markdown", markdownFindings: [finding] })} />);
    expect(screen.getByRole("dialog", { name: "Markdown Findings" })).toBeInTheDocument();
    expect(screen.getByText("build rule")).toHaveClass("markdown-category-build-rule");
    expect(screen.getByText("README.md · README.md:4")).toBeInTheDocument();
  });

  it("renders draft Summary provenance and approves it", () => {
    const value = props({ view: "summary", summary });
    const { rerender } = render(<InitializationDetailsDialog {...value} />);
    expect(screen.getByText("openai / gpt")).toBeInTheDocument();
    expect(screen.getByText("Approval required")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Regenerate Purpose" }));
    expect(value.onRegenerateSummarySection).toHaveBeenCalledWith("project_purpose");
    fireEvent.click(screen.getByRole("button", { name: "Approve Summary" }));
    expect(value.onApproveSummary).toHaveBeenCalledOnce();
    rerender(<InitializationDetailsDialog {...value} initializeLoading />);
    expect(screen.getByRole("button", { name: "Approve Summary" })).toBeDisabled();
  });

  it("reviews an edited claim and requires a rejection reason", () => {
    const pending = { ...summary, claims: [{ ...summary.claims[0], status: "pending" as const }] };
    const value = props({ view: "summary", summary: pending });
    render(<InitializationDetailsDialog {...value} />);
    expect(screen.getByRole("button", { name: "Approve Summary" })).toBeDisabled();
    const claim = screen.getByRole("textbox", { name: "Claim" });
    fireEvent.change(claim, { target: { value: "Edited purpose [source: README.md]" } });
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Rejection reason" }),
      { target: { value: "Incorrect scope" } });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(value.onReviewSummaryClaim).toHaveBeenCalledWith("c1", "rejected",
      "Edited purpose [source: README.md]", "Incorrect scope");
  });

  it("orders approved Knowledge Unit loading, error, empty, and populated states", () => {
    const approved = { ...summary, status: "approved" as const, approvedAt: 2,
      claims: summary.claims.map((claim) => ({ ...claim, status: "pending" as const })) };
    const { rerender } = render(<InitializationDetailsDialog {...props({ view: "summary",
      summary: approved, knowledgeUnitsLoading: true })} />);
    expect(screen.getByText("Summary approved")).toBeInTheDocument();
    expect(screen.queryByLabelText("Summary claim review")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Regenerate Purpose" })).not.toBeInTheDocument();
    expect(screen.getByText("Loading published units…")).toBeInTheDocument();
    rerender(<InitializationDetailsDialog {...props({ view: "summary", summary: approved,
      knowledgeUnitsError: "offline" })} />);
    expect(screen.getByText("Published units could not be loaded")).toBeInTheDocument();
    rerender(<InitializationDetailsDialog {...props({ view: "summary", summary: approved })} />);
    expect(screen.getByText("No Knowledge Units were published")).toBeInTheDocument();
    rerender(<InitializationDetailsDialog {...props({ view: "summary", summary: approved,
      knowledgeUnits: [unit, { ...unit, id: "u2", sources: [], status: "needs_confirmation" }] })} />);
    expect(screen.getByText("README.md:4 · README.md")).toBeInTheDocument();
    expect(screen.getByText("Needs confirmation; no evidence source.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve Summary" })).toBeDisabled();
  });

  it("renders missing Summary and forwards header, action, and backdrop close", () => {
    const value = props({ view: "summary", summary });
    const { container, rerender } = render(<InitializationDetailsDialog {...value} />);
    fireEvent.click(screen.getByRole("button", { name: "Close initialization details" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.mouseDown(container.querySelector(".modal-backdrop")!);
    expect(value.onClose).toHaveBeenCalledTimes(3);
    rerender(<InitializationDetailsDialog {...props({ view: "summary" })} />);
    expect(screen.getByText("No summary available for review")).toBeInTheDocument();
  });
});
