import { describe, expect, it } from "vitest";
import type { TaskPlanStepRunInfo } from "../../types/domain";
import { deriveTaskWaveReviewQueue } from "./taskWaveReviewQueue";

const runs = [
  { id: "run-1", planStepId: "step-1", stepOrderIndex: 0, status: "sent",
    verificationStatus: "changed", scopeStatus: "within_scope" },
  { id: "run-2", planStepId: "step-2", stepOrderIndex: 1, status: "failed",
    verificationStatus: "unavailable", scopeStatus: "unavailable", error: "offline" },
] as TaskPlanStepRunInfo[];

describe("deriveTaskWaveReviewQueue", () => {
  it("grounds and orders structured verdicts by attention then plan order", () => {
    const queue = deriveTaskWaveReviewQueue(JSON.stringify({
      runs: [
        { runId: "run-1", verdict: "pass", summary: "Verified", evidence: ["scope: within_scope"] },
        { runId: "run-2", verdict: "needs_attention", summary: "Worker failed",
          evidence: ["status: failed", "error: offline"] },
      ],
      overall: "needs_attention",
      recommendation: "Review run-2 before accepting the wave.",
    }), runs);
    expect(queue?.items.map(({ runId }) => runId)).toEqual(["run-2", "run-1"]);
    expect(queue?.items[0]).toMatchObject({
      planStepId: "step-2", verdict: "needs_attention", summary: "Worker failed",
    });
    expect(queue?.items[0].evidence).toEqual([
      "status: failed", "verification: unavailable", "scope: unavailable", "error: offline",
    ]);
  });

  it("drops unknown, duplicate, malformed, and unsupported run claims", () => {
    const queue = deriveTaskWaveReviewQueue(`\`\`\`json
      {"runs":[
        {"runId":"run-1","verdict":"pass","summary":"First","evidence":[]},
        {"runId":"run-1","verdict":"needs_attention","summary":"Duplicate","evidence":[]},
        {"runId":"run-x","verdict":"pass","summary":"Unknown","evidence":[]},
        {"runId":"run-2","verdict":"approve","summary":"Unsafe authority","evidence":[]}
      ],"overall":"pass","recommendation":"Review the grounded result."}
    \`\`\``, runs);
    expect(queue?.items).toHaveLength(1);
    expect(queue?.items[0].summary).toBe("First");
  });

  it("rejects prose, invalid envelopes, and reports without grounded items", () => {
    expect(deriveTaskWaveReviewQueue("PASS everything", runs)).toBeNull();
    expect(deriveTaskWaveReviewQueue(
      "{\"runs\":[],\"overall\":\"pass\",\"recommendation\":\"Done\"}", runs,
    )).toBeNull();
    expect(deriveTaskWaveReviewQueue(
      "{\"runs\":[{\"runId\":\"other\",\"verdict\":\"pass\",\"summary\":\"Done\"}],"
      + "\"overall\":\"pass\",\"recommendation\":\"Done\"}", runs,
    )).toBeNull();
  });

  it("does not let a model pass override persisted failure evidence", () => {
    const queue = deriveTaskWaveReviewQueue(JSON.stringify({
      runs: [{ runId: "run-2", verdict: "pass", summary: "Looks fine",
        evidence: ["invented check passed"] }],
      overall: "pass",
      recommendation: "Accept everything.",
    }), runs);
    expect(queue?.overall).toBe("needs_attention");
    expect(queue?.items[0].verdict).toBe("needs_attention");
    expect(queue?.items[0].evidence).not.toContain("invented check passed");
  });
});
