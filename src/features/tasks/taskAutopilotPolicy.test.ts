import { describe, expect, it } from "vitest";
import type { TaskPlanStepRunInfo } from "../../types/domain";
import type { TaskWaveReviewQueue } from "./taskWaveReviewQueue";
import { deriveGuardedAutopilotDecision } from "./taskAutopilotPolicy";

const queue = {
  overall: "needs_attention",
  recommendation: "Review blockers.",
  items: [
    { runId: "safe", planStepId: "step-1", stepOrderIndex: 0, verdict: "pass",
      summary: "Safe", evidence: [] },
    { runId: "attention", planStepId: "step-2", stepOrderIndex: 1,
      verdict: "needs_attention", summary: "Check", evidence: [] },
  ],
} satisfies TaskWaveReviewQueue;

const safe = { id: "safe", status: "sent", scopeStatus: "within_scope",
  verificationStatus: "changed", error: null } as TaskPlanStepRunInfo;

describe("deriveGuardedAutopilotDecision", () => {
  it("allows only grounded pass runs with available within-scope verification", () => {
    expect(deriveGuardedAutopilotDecision(queue, [
      safe,
      { ...safe, id: "attention" },
    ])).toEqual({
      eligibleRunIds: ["safe"],
      blocked: [{ runId: "attention",
        reason: "Evaluator marked this run as needing attention." }],
    });
  });

  it.each([
    [{ status: "failed" }, "Run status is failed, not sent."],
    [{ error: "worker failed" }, "Run recorded an error."],
    [{ scopeStatus: "out_of_scope" }, "Repository scope is not verified within scope."],
    [{ verificationStatus: "unavailable" }, "Repository verification is unavailable."],
  ])("blocks persisted repository evidence: %o", (override, reason) => {
    const decision = deriveGuardedAutopilotDecision({
      ...queue, items: [queue.items[0]],
    }, [{ ...safe, ...override } as TaskPlanStepRunInfo]);
    expect(decision).toEqual({ eligibleRunIds: [], blocked: [{ runId: "safe", reason }] });
  });
});
