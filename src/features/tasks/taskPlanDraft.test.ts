import { describe, expect, it } from "vitest";
import { parseTaskPlanDraft } from "./taskPlanDraft";

const valid = {
  requirements: [{ id: "REQ-1", text: "Cache remains bounded", kind: "functional" }],
  steps: [{ title: "Bound cache", description: "Add LRU eviction", kind: "implementation",
    complexity: 2, acceptanceCriteria: ["Oldest entry is evicted"],
    expectedPaths: ["src/cache.ts"], satisfies: ["REQ-1"], dependsOn: [] }],
};

describe("parseTaskPlanDraft", () => {
  it("extracts a validated plan from the planning JSON fence", () => {
    expect(parseTaskPlanDraft(`Plan summary.\n\n\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``))
      .toEqual(valid);
  });

  it.each([
    "ordinary planning prose",
    "```json\nnot json\n```",
    `\`\`\`json\n${JSON.stringify({ ...valid, requirements: [] })}\n\`\`\``,
    `\`\`\`json\n${JSON.stringify({ ...valid, steps: [{ ...valid.steps[0], satisfies: ["REQ-X"] }] })}\n\`\`\``,
    `\`\`\`json\n${JSON.stringify({ ...valid, steps: [{ ...valid.steps[0], complexity: 9 }] })}\n\`\`\``,
    `\`\`\`json\n${JSON.stringify({ ...valid, steps: [{ ...valid.steps[0], dependsOn: ["STEP-1"] }] })}\n\`\`\``,
  ])("rejects malformed or incomplete evidence without inventing a draft", (evidence) => {
    expect(parseTaskPlanDraft(evidence)).toBeNull();
  });
});
