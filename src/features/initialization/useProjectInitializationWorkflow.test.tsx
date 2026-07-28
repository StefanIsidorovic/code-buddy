import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModelProfileInfo, ProjectInfo, ProjectInitializationInfo,
  ProjectInitializationSummaryInfo, ProjectRepositoryInfo } from "../../types/domain";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
import { useProjectInitializationWorkflow } from "./useProjectInitializationWorkflow";

const project: ProjectInfo = { id: "p1", name: "AIadne", path: "/work", createdAt: 1, updatedAt: 1 };
const repository: ProjectRepositoryInfo = { id: "r1", projectId: "p1", name: "core", path: "/core",
  isDefault: true, createdAt: 1, updatedAt: 1 };
const initialization: ProjectInitializationInfo = { id: "i1", projectId: "p1", status: "preflight",
  repositoryCount: 1, createdAt: 1, updatedAt: 1 };
const profile: ModelProfileInfo = { id: "m1", providerId: "openai", modelId: "gpt", displayName: "GPT",
  tier: "mid", parameters: [], capabilities: { structuredOutput: "supported", reasoningControl: "supported",
    backgroundMode: "unknown", api: "supported", cli: "unknown", acp: "unknown" }, status: "selectable",
  unavailableReason: null };
const summary: ProjectInitializationSummaryInfo = { id: "s1", initializationId: "i1", status: "draft",
  projectPurpose: "Purpose", repositoryMap: "Map", repositoryRoles: "Roles", buildTestMatrix: "Tests",
  fragileAreas: "Fragile", doNotTouchRules: "Rules", agentWorkingRules: "Work", openQuestions: "None", claims: [],
  factCount: 1, markdownFindingCount: 1, guardrailCount: 1, requestedModelProfileId: "m1",
  requestedModelProviderId: "openai", requestedModelId: "gpt", requestedModelTier: "mid",
  requestedModelParameters: [], modelCatalogSchemaVersion: 1, knowledgeSchemaVersion: 1,
  generationEngine: "test", createdAt: 1, approvedAt: null };

function setup(overrides: Record<string, unknown> = {}) {
  const evidence = { setInitialization: vi.fn(), advanceStatus: vi.fn(), setFacts: vi.fn(),
    setMarkdown: vi.fn(), setGuardrails: vi.fn(), setSummary: vi.fn(), refreshUnits: vi.fn().mockResolvedValue(undefined) };
  const notify = vi.fn();
  const options = { project, repositories: [repository], selectedRepositoryId: "r1", initialization,
    guardrails: [], summary, modelProfile: profile, evidence, notify, ...overrides };
  return { evidence, notify, ...renderHook(() => useProjectInitializationWorkflow(options)) };
}

describe("useProjectInitializationWorkflow", () => {
  beforeEach(() => invoke.mockReset());

  it("opens initialized repository scope and creates initialization with the exact payload", async () => {
    invoke.mockResolvedValue(initialization); const { result, evidence } = setup({ initialization: null });
    act(() => result.current.openDialog()); expect(result.current.repositoryIds).toEqual(["r1"]);
    await act(() => result.current.createInitialization());
    expect(invoke).toHaveBeenCalledWith("create_project_initialization",
      { request: { projectId: "p1", repositoryIds: ["r1"] } });
    expect(evidence.setInitialization).toHaveBeenCalledWith(initialization);
    expect(result.current.dialogOpen).toBe(false);
  });

  it("validates and builds repository-scoped interview guardrails", () => {
    const { result } = setup(); act(() => result.current.openInterview());
    act(() => result.current.addGuardrail());
    expect(result.current.interviewError).toBe("Describe the guardrail before adding it.");
    act(() => { result.current.changeScope("repository"); result.current.changeContent("Do not edit");
      result.current.changePathPattern(" generated/** "); });
    act(() => result.current.addGuardrail());
    expect(result.current.drafts[0]).toEqual({ repositoryId: "r1", kind: "fragile",
      pathPattern: "generated/**", content: "Do not edit" });
  });

  it("collects Facts and advances status through semantic evidence actions", async () => {
    const facts = [{ id: "f1", initializationId: "i1", repositoryId: "r1", repositoryName: "core",
      repositoryPath: "/core", kind: "runtime", label: "Language", value: "Rust", source: "Cargo.toml", createdAt: 1 }];
    invoke.mockResolvedValue(facts); const { result, evidence, notify } = setup();
    await act(() => result.current.collectFacts());
    expect(evidence.setFacts).toHaveBeenCalledWith("i1", facts);
    expect(evidence.advanceStatus).toHaveBeenCalledWith(initialization, "facts");
    expect(notify).toHaveBeenCalledWith("success", "Facts collected for 1 repositories.");
  });

  it("generates and approves Summary through the selected profile", async () => {
    const approved = { ...summary, status: "approved", approvedAt: 2 } as ProjectInitializationSummaryInfo;
    invoke.mockResolvedValueOnce(summary).mockResolvedValueOnce(approved);
    const { result, evidence } = setup(); await act(() => result.current.generateSummary());
    expect(invoke).toHaveBeenCalledWith("generate_project_initialization_summary",
      { request: { initializationId: "i1", modelProfileId: "m1" } });
    await act(() => result.current.approveSummary());
    expect(evidence.setSummary).toHaveBeenLastCalledWith("i1", approved);
    expect(evidence.refreshUnits).toHaveBeenCalledWith("i1");
  });

  it("exposes a Summary-specific loading state while synthesis is pending", async () => {
    let resolveSummary: (value: ProjectInitializationSummaryInfo) => void = () => undefined;
    invoke.mockImplementationOnce(() => new Promise((resolve) => { resolveSummary = resolve; }));
    const { result } = setup();
    let generation: Promise<void> = Promise.resolve();
    act(() => { generation = result.current.generateSummary(); });
    expect(result.current.summaryGenerating).toBe(true);
    await act(async () => { resolveSummary(summary); await generation; });
    expect(result.current.summaryGenerating).toBe(false);
  });

  it("persists a typed claim review and refreshes the current Summary", async () => {
    const reviewed = { ...summary, claims: [{ id: "c1", section: "project_purpose", claimIndex: 0,
      originalContent: "Purpose", content: "Edited [source: README.md]", status: "accepted" as const,
      rejectionReason: null }] };
    invoke.mockResolvedValueOnce(reviewed);
    const { result, evidence } = setup();
    await act(() => result.current.reviewSummaryClaim("c1", "accepted",
      "Edited [source: README.md]", null));
    expect(invoke).toHaveBeenCalledWith("review_project_initialization_summary_claim", {
      request: { summaryId: "s1", claimId: "c1", status: "accepted",
        content: "Edited [source: README.md]", rejectionReason: null },
    });
    expect(evidence.setSummary).toHaveBeenCalledWith("i1", reviewed);
  });

  it("prepares the current Summary with Autopilot through one typed command", async () => {
    const prepared = { ...summary, claims: [{ id: "c1", section: "project_purpose", claimIndex: 0,
      originalContent: "Purpose", content: "Purpose", status: "accepted" as const,
      rejectionReason: null }] };
    invoke.mockResolvedValueOnce(prepared);
    const { result, evidence, notify } = setup();
    await act(() => result.current.prepareSummaryAutopilot());
    expect(invoke).toHaveBeenCalledWith("prepare_project_initialization_summary_autopilot",
      { summaryId: "s1" });
    expect(evidence.setSummary).toHaveBeenCalledWith("i1", prepared);
    expect(notify).toHaveBeenCalledWith("success",
      "Autopilot prepared the Summary for final approval.");
  });

  it("regenerates one Summary section through the current Summary identity", async () => {
    const regenerated = { ...summary, projectPurpose: "New purpose", claims: [] };
    invoke.mockResolvedValueOnce(regenerated);
    const { result, evidence, notify } = setup();
    await act(() => result.current.regenerateSummarySection("project_purpose"));
    expect(invoke).toHaveBeenCalledWith("regenerate_project_initialization_summary_section", {
      request: { summaryId: "s1", section: "project_purpose" },
    });
    expect(evidence.setSummary).toHaveBeenCalledWith("i1", regenerated);
    expect(notify).toHaveBeenCalledWith("success", "Summary section regenerated for review.");
  });
});
