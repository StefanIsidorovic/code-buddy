import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  AcpSessionInfo,
  ProjectInitializationSummaryInfo,
  TaskInfo,
} from "./domain";

describe("frontend domain contracts", () => {
  it("retains ACP session model capability nesting", () => {
    const session = {
      id: "acp-1",
      state: "running",
      pid: 42,
      cwd: "/workspace",
      protocolVersion: 1,
      agentSessionId: "agent-1",
      agentName: "Codex",
      agentVersion: "1.0",
      exitCode: null,
      codingModel: {
        currentValue: "gpt-5.6",
        options: [{ value: "gpt-5.6", name: "GPT-5.6", description: null }],
      },
    } satisfies AcpSessionInfo;

    expect(session.codingModel.options[0].value).toBe("gpt-5.6");
  });

  it("keeps summary model provenance fields nullable", () => {
    expectTypeOf<ProjectInitializationSummaryInfo["requestedModelTier"]>()
      .toEqualTypeOf<"fast" | "mid" | "high" | "max" | null>();
    expectTypeOf<ProjectInitializationSummaryInfo["approvedAt"]>()
      .toEqualTypeOf<number | null>();
  });

  it("keeps Task phases ordered by a closed phase union", () => {
    expectTypeOf<TaskInfo["currentPhase"]>()
      .toEqualTypeOf<"analysis" | "planning" | "execution" | "review">();
    expectTypeOf<TaskInfo["phases"][number]["phase"]>()
      .toEqualTypeOf<TaskInfo["currentPhase"]>();
  });
});
