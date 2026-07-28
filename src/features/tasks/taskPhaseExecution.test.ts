import { describe, expect, it } from "vitest";
import type { TaskInfo } from "../../types/domain";
import { buildTaskPhaseExecutionPrompt, executionVerificationForTask } from "./taskPhaseExecution";

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

describe("executionVerificationForTask", () => {
  it("restores durable execution verification and ignores malformed changed-file JSON", () => {
    const verification = executionVerificationForTask({ ...base, id: "task",
      currentPhase: "execution" }, [{
      id: "run", taskId: "task", transcriptSessionId: "session", sequence: 0,
      phase: "execution", acpSessionId: "acp", instruction: "Implement", status: "sent",
      stopReason: "end_turn", error: null, verificationStatus: "changed",
      verificationWorkspacePath: "/repo", verificationChangedFilesJson: "not-json",
      verificationError: null, createdAt: 1, updatedAt: 2,
    }], null);
    expect(verification).toMatchObject({
      taskId: "task", status: "changed", workspacePath: "/repo", changedFiles: [],
    });
  });
});
