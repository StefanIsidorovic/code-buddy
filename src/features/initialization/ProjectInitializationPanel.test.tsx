import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectInfo, ProjectInitializationFactInfo, ProjectInitializationGuardrailInfo,
  ProjectInitializationInfo, ProjectInitializationMarkdownFindingInfo } from "../../types/domain";
import { ProjectInitializationPanel, type ProjectInitializationPanelProps } from "./ProjectInitializationPanel";

const project: ProjectInfo = { id: "p1", name: "AIadne", path: "/work", createdAt: 1, updatedAt: 1 };
const initialization: ProjectInitializationInfo = { id: "i1", projectId: "p1", status: "markdown",
  repositoryCount: 1, createdAt: 1, updatedAt: 1 };
const fact: ProjectInitializationFactInfo = { id: "f1", initializationId: "i1", repositoryId: "r1",
  repositoryName: "core", repositoryPath: "/core", kind: "runtime", label: "Language", value: "Rust",
  source: "Cargo.toml", createdAt: 1 };
const finding: ProjectInitializationMarkdownFindingInfo = { id: "m1", initializationId: "i1",
  repositoryId: "r1", repositoryName: "core", repositoryPath: "/core", filePath: "README.md",
  category: "build_rule", title: "Build", excerpt: "test", source: "README.md:1", createdAt: 1 };
const guardrail: ProjectInitializationGuardrailInfo = { id: "g1", initializationId: "i1",
  repositoryId: null, repositoryName: null, repositoryPath: null, guardrailIndex: 0, scope: "project",
  kind: "do_not_touch", pathPattern: "gen/**", content: "Generated", source: "interview", createdAt: 1 };
function props(overrides: Partial<ProjectInitializationPanelProps> = {}): ProjectInitializationPanelProps {
  return { expanded: true, factGroupsCount: 0, factPreviews: [], facts: [], guardrails: [], initialization: null,
    loading: false, markdownFindings: [], markdownPreviews: [], project: null, repositoryCount: 0,
    summaryProps: { catalog: null, loading: false, profileId: "", selectedProfile: null, summary: null,
      tier: "mid", onChangeProfile: vi.fn(), onChangeTier: vi.fn(), onGenerate: vi.fn(), onView: vi.fn() },
    onExpandedChange: vi.fn(), onAnalyzeMarkdown: vi.fn(), onCollectFacts: vi.fn(), onInitialize: vi.fn(),
    onOpenInterview: vi.fn(), onViewFacts: vi.fn(), onViewMarkdown: vi.fn(), ...overrides };
}
describe("project initialization panel", () => {
  it("keeps initialization compact until opened or started", () => {
    const value = props({ expanded: false, project, repositoryCount: 1 });
    render(<ProjectInitializationPanel {...value} />);
    expect(screen.getByRole("heading", { name: "Project Initialization" })).toBeInTheDocument();
    expect(screen.getByText("Ready to initialize project knowledge")).toBeInTheDocument();
    expect(screen.queryByLabelText("Project initialization phases")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open setup" }));
    expect(value.onExpandedChange).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Initialize Project" }));
    expect(value.onExpandedChange).toHaveBeenCalledWith(true);
    expect(value.onInitialize).toHaveBeenCalledOnce();
  });
  it("renders workspace, repository, and ready prerequisites", () => {
    const { rerender } = render(<ProjectInitializationPanel {...props()} />);
    expect(screen.getByText("Choose a workspace to begin")).toBeInTheDocument();
    rerender(<ProjectInitializationPanel {...props({ project })} />);
    expect(screen.getByText("Add a repository before initialization")).toBeInTheDocument();
    rerender(<ProjectInitializationPanel {...props({ project, repositoryCount: 1 })} />);
    expect(screen.getByText("Ready to initialize project knowledge")).toBeInTheDocument();
  });
  it("renders phase/preflight state and starts initialization", () => {
    const value = props({ project, repositoryCount: 1, initialization });
    render(<ProjectInitializationPanel {...value} />);
    expect(screen.getByText("Markdown · 1 repository")).toBeInTheDocument();
    expect(screen.getByText("Preflight").closest("li")).toHaveAttribute("data-state", "complete");
    expect(screen.getAllByText("Markdown")[0].closest("li")).toHaveAttribute("data-state", "current");
    fireEvent.click(screen.getByRole("button", { name: "Initialize Project" }));
    expect(value.onInitialize).toHaveBeenCalledOnce();
  });
  it("renders Facts preview and forwards collect/view actions", () => {
    const value = props({ project, repositoryCount: 1, initialization, facts: [fact], factGroupsCount: 1,
      factPreviews: [{ repositoryId: "r1", repositoryName: "core", facts: [fact], totalFacts: 4 }] });
    render(<ProjectInitializationPanel {...value} />);
    expect(screen.getByText("1/4 shown")).toBeInTheDocument(); expect(screen.getByText("Language: Rust")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Collect Facts" }));
    fireEvent.click(screen.getByRole("button", { name: "View Facts" }));
    expect(value.onCollectFacts).toHaveBeenCalledOnce(); expect(value.onViewFacts).toHaveBeenCalledOnce();
  });
  it("renders Markdown preview and forwards analyze/view actions", () => {
    const value = props({ project, repositoryCount: 1, initialization, markdownFindings: [finding],
      markdownPreviews: [finding] }); render(<ProjectInitializationPanel {...value} />);
    expect(screen.getByText("build rule")).toBeInTheDocument(); expect(screen.getByText("README.md · README.md:1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Analyze Markdown" }));
    fireEvent.click(screen.getByRole("button", { name: "View Findings" }));
    expect(value.onAnalyzeMarkdown).toHaveBeenCalledOnce(); expect(value.onViewMarkdown).toHaveBeenCalledOnce();
  });
  it("renders Interview guardrails, empty evidence notices, and action locks", () => {
    const value = props({ project, repositoryCount: 1, initialization, guardrails: [guardrail], loading: true });
    render(<ProjectInitializationPanel {...value} />);
    expect(screen.getByText("Do not touch")).toBeInTheDocument(); expect(screen.getByText("Project-wide")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Interview" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Collect Facts" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "View Facts" })).toBeDisabled();
  });
});
