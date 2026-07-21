import { describe, expect, it } from "vitest";
import type { TaskInfo } from "../../types/domain";
import { buildTaskPhaseExecutionPrompt } from "./taskPhaseExecution";

const base = { originalPrompt: "Fix the parser without changing the wire format" } as TaskInfo;

describe("buildTaskPhaseExecutionPrompt", () => {
  it.each([
    ["analysis", "Do not implement changes."],
    ["planning", "concrete implementation plan"],
    ["execution", "Implement only the approved plan."],
    ["review", "Review the implementation adversarially"],
  ] as const)("builds a bounded %s instruction", (phase, boundary) => {
    const prompt = buildTaskPhaseExecutionPrompt({ ...base, currentPhase: phase });
    expect(prompt).toContain(`Run only the ${phase} phase`);
    expect(prompt).toContain(base.originalPrompt);
    expect(prompt).toContain(boundary);
    expect(prompt).toContain("explicit user-controlled gates");
  });
});
