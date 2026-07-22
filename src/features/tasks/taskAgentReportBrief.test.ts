import { describe, expect, it } from "vitest";
import type { TaskAgentReportInfo } from "../../types/domain";
import { buildTaskAgentFindingFollowUpPrompt, deriveTaskAgentFindings } from "./taskAgentReportBrief";

function report(overrides: Partial<TaskAgentReportInfo> = {}): TaskAgentReportInfo {
  return {
    id: "report-1",
    taskId: "task-1",
    phase: "analysis",
    sequence: 0,
    role: "advisor",
    transcriptSessionId: "advisor-transcript",
    content: "",
    sourceTranscriptEventIds: ["event-1"],
    createdAt: 1,
    ...overrides,
  };
}

describe("deriveTaskAgentFindings", () => {
  it("extracts exact actionable lines from newest reports first", () => {
    const findings = deriveTaskAgentFindings([
      report({ id: "old", sequence: 0, role: "advisor", content: "- Add a guard\n- Add a guard" }),
      report({ id: "new", sequence: 1, role: "reviewer", content: "1. Missing test for retry\n2. Verify provenance note" }),
    ]);
    expect(findings.map(({ content }) => content)).toEqual([
      "Missing test for retry",
      "Verify provenance note",
      "Add a guard",
    ]);
    expect(findings[0]).toMatchObject({ id: "new:0", role: "reviewer", kind: "risk",
      transcriptSessionId: "advisor-transcript", provenanceEventCount: 1 });
    expect(findings[1].kind).toBe("check");
    expect(findings[2].kind).toBe("suggestion");
  });

  it("keeps empty reports silent and trims long fallback content", () => {
    const long = "A".repeat(240);
    const findings = deriveTaskAgentFindings([
      report({ id: "empty", content: " \n\t " }),
      report({ id: "long", content: long }),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].content).toHaveLength(220);
    expect(findings[0].content.endsWith("…")).toBe(true);
    expect(findings[0].kind).toBe("note");
  });

  it("bounds noisy reports without inventing extra findings", () => {
    const findings = deriveTaskAgentFindings([report({
      content: ["Fix the boundary", "Review the tests", "Risk: stale task", "Need docs", "Confirm build"].join("\n"),
    })]);
    expect(findings.map(({ content }) => content)).toEqual([
      "Fix the boundary",
      "Review the tests",
      "Risk: stale task",
    ]);
  });

  it("drafts a bounded follow-up prompt without claiming evidence or mutation authority", () => {
    const [finding] = deriveTaskAgentFindings([report({ content: "Risk: stale task ownership" })]);
    const draft = buildTaskAgentFindingFollowUpPrompt(finding);
    expect(draft).toContain("Follow up on this advisor risk from the analysis review brief:");
    expect(draft).toContain("Risk: stale task ownership");
    expect(draft).toContain("Source: transcript advisor-transcript, 1 provenance event(s).");
    expect(draft).toContain("Do not save Task evidence, complete phases, or change files unless I explicitly ask.");
  });
});
