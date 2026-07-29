import { describe, expect, it } from "vitest";
import type { TaskPlanStepInfo, TaskPlanStepRunInfo } from "../../types/domain";
import { currentTaskExecutionWave, deriveTaskExecutionWaves, dispatchableWaveSteps }
  from "./taskExecutionWaves";

const step = (orderIndex: number, expectedPaths: string[], dependsOn: string[] = []):
TaskPlanStepInfo => ({
  id: `step-${orderIndex + 1}`, orderIndex, title: `Step ${orderIndex + 1}`,
  description: "Bounded work", kind: "implementation", complexity: 2,
  acceptanceCriteria: ["Done"], expectedPaths, satisfies: ["REQ-1"], dependsOn,
});

describe("deriveTaskExecutionWaves", () => {
  it("groups independent non-overlapping steps and unlocks their dependent step", () => {
    const waves = deriveTaskExecutionWaves([
      step(0, ["src/cache/**"]),
      step(1, ["src/auth/**"]),
      step(2, ["src/app.ts"], ["STEP-1", "STEP-2"]),
    ]);
    expect(waves.map((wave) => wave.steps.map(({ id }) => id)))
      .toEqual([["step-1", "step-2"], ["step-3"]]);
    expect(waves[0].parallel).toBe(true);
  });

  it("serializes overlapping exact, directory and glob scopes deterministically", () => {
    const waves = deriveTaskExecutionWaves([
      step(0, ["src/**"]),
      step(1, ["src/cache.ts"]),
      step(2, ["docs/readme.md"]),
    ]);
    expect(waves.map((wave) => wave.steps.map(({ id }) => id)))
      .toEqual([["step-1", "step-3"], ["step-2"]]);
  });

  it("serializes a step without a declared write scope", () => {
    const waves = deriveTaskExecutionWaves([
      step(0, []),
      step(1, ["src/cache.ts"]),
    ]);
    expect(waves.map((wave) => wave.steps.map(({ id }) => id)))
      .toEqual([["step-1"], ["step-2"]]);
    expect(waves[0].reason).toContain("no declared write scope");
  });

  it("keeps later waves locked until every current-wave step is integrated", () => {
    const steps = [
      step(0, ["src/cache/**"]),
      step(1, ["src/auth/**"]),
      step(2, ["src/app.ts"], ["STEP-1", "STEP-2"]),
    ];
    const accepted = (planStepId: string, integrated: boolean) => ({
      planStepId, status: "accepted", isolationId: "isolation",
      integrationStatus: integrated ? "integrated" : null,
    }) as TaskPlanStepRunInfo;
    const partial = [accepted("step-1", true), accepted("step-2", false)];
    const current = currentTaskExecutionWave(steps, partial);
    expect(current?.number).toBe(1);
    expect(dispatchableWaveSteps(current, partial)).toEqual([]);
    expect(currentTaskExecutionWave(steps, [
      accepted("step-1", true), accepted("step-2", true),
    ])?.number).toBe(2);
  });
});
