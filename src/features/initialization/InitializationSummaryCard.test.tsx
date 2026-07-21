import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ModelCatalogInfo, ModelProfileInfo, ProjectInitializationSummaryInfo } from "../../types/domain";
import { InitializationSummaryCard, type InitializationSummaryCardProps } from "./InitializationSummaryCard";

const profile: ModelProfileInfo = { id: "p1", providerId: "openai", modelId: "gpt",
  displayName: "GPT", tier: "mid", parameters: [], status: "selectable", unavailableReason: null,
  capabilities: { structuredOutput: "supported", reasoningControl: "supported",
    backgroundMode: "unsupported", api: "supported", cli: "unknown", acp: "unsupported" } };
const unavailable: ModelProfileInfo = { ...profile, id: "p2", displayName: "Future",
  status: "unavailable", unavailableReason: "Adapter missing" };
const catalog: ModelCatalogInfo = { schemaVersion: 1,
  providers: [{ id: "openai", displayName: "OpenAI" }], profiles: [profile, unavailable] };
const summary: ProjectInitializationSummaryInfo = { id: "s1", initializationId: "i1", status: "draft",
  projectPurpose: "purpose", repositoryMap: "map", repositoryRoles: "roles", buildTestMatrix: "tests",
  fragileAreas: "fragile", doNotTouchRules: "none", agentWorkingRules: "rules", openQuestions: "none",
  factCount: 2, markdownFindingCount: 3, guardrailCount: 4, requestedModelProfileId: "p1",
  requestedModelProviderId: "openai", requestedModelId: "gpt", requestedModelTier: "mid",
  requestedModelParameters: [], modelCatalogSchemaVersion: 1, knowledgeSchemaVersion: 1,
  generationEngine: "openai_responses_v1", createdAt: 1, approvedAt: null };
function props(overrides: Partial<InitializationSummaryCardProps> = {}): InitializationSummaryCardProps {
  return { catalog, loading: false, profileId: "p1", selectedProfile: profile, summary: null,
    tier: "mid", onChangeProfile: vi.fn(), onChangeTier: vi.fn(), onGenerate: vi.fn(),
    onView: vi.fn(), ...overrides };
}
describe("initialization summary card", () => {
  it("renders tiers and forwards tier/profile changes", () => {
    const value = props(); render(<InitializationSummaryCard {...value} />);
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "High" }));
    fireEvent.change(screen.getByLabelText("Synthesis model"), { target: { value: "p2" } });
    expect(value.onChangeTier).toHaveBeenCalledWith("high");
    expect(value.onChangeProfile).toHaveBeenCalledWith("p2");
  });
  it("renders provider, capabilities, and unavailable option reason", () => {
    render(<InitializationSummaryCard {...props()} />);
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByTitle("structured: supported")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Future — Adapter missing" })).toBeDisabled();
  });
  it("renders no-profile tier and locks generation for unavailable/loading profiles", () => {
    const { rerender } = render(<InitializationSummaryCard {...props({ tier: "max", profileId: "",
      selectedProfile: null })} />);
    expect(screen.getByRole("option", { name: "No profile for this tier" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate Summary" })).toBeDisabled();
    rerender(<InitializationSummaryCard {...props({ selectedProfile: unavailable })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Adapter missing");
    expect(screen.getByRole("button", { name: "Generate Summary" })).toBeDisabled();
  });
  it("forwards generate/view and renders draft and approved previews", () => {
    const value = props({ summary }); const { rerender } = render(<InitializationSummaryCard {...value} />);
    fireEvent.click(screen.getByRole("button", { name: "Generate Summary" }));
    fireEvent.click(screen.getByRole("button", { name: "View Summary" }));
    expect(value.onGenerate).toHaveBeenCalledOnce(); expect(value.onView).toHaveBeenCalledOnce();
    expect(screen.getByText("Draft profile is ready for review.")).toBeInTheDocument();
    rerender(<InitializationSummaryCard {...value} summary={{ ...summary, status: "approved" }} />);
    expect(screen.getByText("Approved profile is ready for agent context.")).toBeInTheDocument();
  });
  it("renders the empty summary prerequisite and locks View", () => {
    render(<InitializationSummaryCard {...props()} />);
    expect(screen.getByText("No summary draft")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Summary" })).toBeDisabled();
  });
});
