import { describe, expect, it } from "vitest";
import {
  acpCandidateStatusLabel, capabilityLabel, coalesceAcpEvents, doctorDetail, doctorStatusLabel,
  errorText, filterTranscriptSessions, folderNameFromPath,
  formatMarkdownCategory, formatModelTier, formatPromptWithKnowledge, formatTimestamp,
  guardrailKindClassName, guardrailKindLabel, modelCapabilityBadges,
  markdownCategoryClassName,
  transcriptEventToAcpEvent, transportDetail, uniqueIds,
} from "./presentation";

describe("presentation helpers", () => {
  it("keeps the original prompt when no knowledge is attached", () => {
    expect(formatPromptWithKnowledge([], "Fix the bug")).toBe("Fix the bug");
  });

  it("renders attached knowledge separately from the user prompt", () => {
    expect(formatPromptWithKnowledge([
      { title: "Rule", body: "Run tests", kind: "guardrail", scope: "project" },
    ], "Fix the bug")).toContain("Rule (guardrail, project)\nRun tests\n\nUser prompt:\nFix the bug");
  });

  it("filters sessions across human fields and short ids", () => {
    const sessions = [{ id: "abcdefgh-1234", projectId: "p1", runtime: "acp", source: "Codex", title: "Refactor" }];
    expect(filterTranscriptSessions(sessions, "CODEX")).toEqual(sessions);
    expect(filterTranscriptSessions(sessions, "abcdefgh")).toEqual(sessions);
    expect(filterTranscriptSessions(sessions, "missing")).toEqual([]);
  });

  it("coalesces only adjacent streamed agent and plan events", () => {
    expect(coalesceAcpEvents([
      { kind: "agent_message", content: "Hello" },
      { kind: "agent_message", content: "world" },
      { kind: "notice", content: "one" },
      { kind: "notice", content: "two" },
    ])).toEqual([
      { kind: "agent_message", content: "Hello world" },
      { kind: "notice", content: "one" },
      { kind: "notice", content: "two" },
    ]);
  });

  it("normalizes unknown persisted event kinds to notices", () => {
    expect(transcriptEventToAcpEvent({ kind: "future_kind", content: "data" })).toEqual({ kind: "notice", content: "data" });
  });

  it("handles path, error, and unique-id edge cases", () => {
    expect(folderNameFromPath("C:\\work\\AIadne\\")).toBe("AIadne");
    expect(folderNameFromPath("///")).toBe("Project");
    expect(errorText(new Error("broken"))).toBe("broken");
    expect(uniqueIds(["a", "a", "b"])).toEqual(["a", "b"]);
  });

  it("formats guardrail kinds for labels and stable CSS classes", () => {
    expect(guardrailKindLabel("do_not_touch")).toBe("Do not touch");
    expect(guardrailKindLabel("custom-kind")).toBe("custom kind");
    expect(guardrailKindClassName("Needs REVIEW!")).toBe(
      "guardrail-kind guardrail-kind-needs-review-",
    );
  });

  it("formats markdown categories for labels and stable CSS classes", () => {
    expect(formatMarkdownCategory("build_rule")).toBe("build rule");
    expect(markdownCategoryClassName("Build RULE!")).toBe(
      "markdown-category markdown-category-build-rule-",
    );
  });

  it("formats persisted Unix timestamps for compact history metadata", () => {
    expect(formatTimestamp(1_700_000_000)).toMatch(/\d/);
  });

  it("labels every ACP registry candidate state", () => {
    expect(["ready", "installable", "missing_runner", "missing_binary"].map(acpCandidateStatusLabel))
      .toEqual(["Ready", "Installable", "Missing runner", "Missing binary"]);
  });

  it("formats Doctor status, detail, and transport capabilities", () => {
    expect(["installed", "missing", "error"].map(doctorStatusLabel))
      .toEqual(["Installed", "Missing", "Error"]);
    expect(capabilityLabel("unsupported")).toBe("Unsupported");
    expect(doctorDetail({ status: "installed", version: null, path: "/bin/tool",
      error: null, installHint: "install" })).toBe("/bin/tool");
    expect(transportDetail({ pty: "supported", acpStdio: "unknown" }))
      .toBe("PTY: Supported · ACP: Unknown");
  });

  it("formats synthesis tiers and capability badges", () => {
    expect(formatModelTier("mid")).toBe("Mid");
    expect(modelCapabilityBadges({ capabilities: { structuredOutput: "supported",
      reasoningControl: "unknown", backgroundMode: "unsupported", api: "supported",
      cli: "unknown", acp: "unsupported" } })).toHaveLength(6);
  });
});
