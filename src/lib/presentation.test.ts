import { describe, expect, it } from "vitest";
import {
  coalesceAcpEvents, errorText, filterTranscriptSessions, folderNameFromPath,
  formatPromptWithKnowledge, guardrailKindClassName, guardrailKindLabel,
  transcriptEventToAcpEvent, uniqueIds,
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
});
