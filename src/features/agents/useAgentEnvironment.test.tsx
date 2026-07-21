import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AgentDoctorReport,
  ModelCatalogInfo,
  ModelProfileInfo,
  ProjectInitializationSummaryInfo,
} from "../../types/domain";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
import { useAgentEnvironment } from "./useAgentEnvironment";

const profile = (id: string, tier: ModelProfileInfo["tier"], status: ModelProfileInfo["status"] = "selectable"):
  ModelProfileInfo => ({ id, providerId: "openai", modelId: id, displayName: id, tier, parameters: [], status,
    unavailableReason: status === "unavailable" ? "Unavailable" : null, capabilities: { structuredOutput: "supported",
      reasoningControl: "supported", backgroundMode: "unsupported", api: "supported", cli: "unknown",
      acp: "unsupported" } });
const catalog: ModelCatalogInfo = { schemaVersion: 1,
  providers: [{ id: "openai", displayName: "OpenAI" }],
  profiles: [profile("fast", "fast"), profile("high-off", "high", "unavailable"), profile("high", "high")] };
const doctor: AgentDoctorReport = { adapter: { id: "codex", displayName: "Codex", executable: "codex",
  transports: { pty: "supported", acpStdio: "supported" } }, status: "installed", path: "/bin/codex",
  version: "1", error: null, installHint: "" };
const summary: ProjectInitializationSummaryInfo = { id: "s1", initializationId: "i1", status: "draft",
  projectPurpose: "", repositoryMap: "", repositoryRoles: "", buildTestMatrix: "", fragileAreas: "",
  doNotTouchRules: "", agentWorkingRules: "", openQuestions: "", factCount: 0, markdownFindingCount: 0,
  guardrailCount: 0, requestedModelProfileId: "fast", requestedModelProviderId: "openai",
  requestedModelId: "fast", requestedModelTier: "fast", requestedModelParameters: [],
  modelCatalogSchemaVersion: 1, knowledgeSchemaVersion: 1, generationEngine: "test", createdAt: 1,
  approvedAt: null };

function setup(initialSummary: ProjectInitializationSummaryInfo | null = null) {
  const notifyError = vi.fn();
  return { notifyError, ...renderHook(({ value }) => useAgentEnvironment({ summary: value, notifyError }),
    { initialProps: { value: initialSummary } }) };
}

describe("useAgentEnvironment", () => {
  beforeEach(() => invoke.mockReset());

  it("loads Doctor and catalog data and selects the first usable fallback", async () => {
    invoke.mockImplementation((command) => command === "list_agent_doctor_reports"
      ? Promise.resolve([doctor]) : Promise.resolve(catalog));
    const { result } = setup();
    await waitFor(() => expect(result.current.catalog).toEqual(catalog));
    expect(result.current.canStartCodex).toBe(true);
    expect(result.current.profileId).toBe("fast");
    expect(result.current.tier).toBe("fast");
  });

  it("reports Doctor errors locally and clears them after a successful refresh", async () => {
    invoke.mockImplementation((command) => command === "list_agent_doctor_reports"
      ? Promise.reject(new Error("doctor failed")) : Promise.resolve(catalog));
    const { result } = setup();
    await waitFor(() => expect(result.current.doctorError).toBe("doctor failed"));
    invoke.mockImplementation((command) => command === "list_agent_doctor_reports"
      ? Promise.resolve([doctor]) : Promise.resolve(catalog));
    await act(() => result.current.refreshDoctor());
    expect(result.current.doctorError).toBeNull();
    expect(result.current.canStartCodex).toBe(true);
  });

  it("surfaces an invalid model catalog through the shared notification boundary", async () => {
    invoke.mockImplementation((command) => command === "list_agent_doctor_reports"
      ? Promise.resolve([]) : Promise.resolve({ providers: null, profiles: null }));
    const { notifyError } = setup();
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith("Invalid model catalog response."));
  });

  it("selects a usable tier profile and restores model provenance from Summary", async () => {
    invoke.mockImplementation((command) => command === "list_agent_doctor_reports"
      ? Promise.resolve([doctor]) : Promise.resolve(catalog));
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.catalog).toEqual(catalog));
    act(() => result.current.changeTier("high"));
    expect(result.current.profileId).toBe("high");
    rerender({ value: summary });
    await waitFor(() => expect(result.current.profileId).toBe("fast"));
    expect(result.current.tier).toBe("fast");
  });
});
