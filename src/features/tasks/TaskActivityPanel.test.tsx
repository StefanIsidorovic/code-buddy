import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TaskInfo, TaskPhaseArtifactInfo, TaskPhaseRunReceiptInfo } from "../../types/domain";
import { TaskActivityPanel } from "./TaskActivityPanel";

const task: TaskInfo = {
  id: "task-1", projectId: "project-1", transcriptSessionId: "session-1",
  originalPrompt: "Improve path caching", status: "completed", currentPhase: "review",
  initialComplexityProfile: "complex", initialComplexityReasons: [], initialComplexityConfidence: 1,
  complexityProfile: "complex", complexityReasons: [], complexityConfidence: 1,
  complexitySource: "system", complexityAssessmentVersion: "v1",
  phases: ["analysis", "planning", "execution", "review"].map((phase, phaseIndex) => ({
    id: `phase-${phase}`, taskId: "task-1", phase: phase as TaskInfo["currentPhase"], phaseIndex,
    status: "completed", startedAt: 1, completedAt: 2,
  })),
  createdAt: 1, updatedAt: 2,
};
const artifact: TaskPhaseArtifactInfo = {
  id: "artifact-1", taskId: "task-1", phase: "review", sequence: 0, kind: "summary",
  content: "The cache is bounded and the focused package tests pass.",
  sourceTranscriptEventIds: ["event-1", "event-2"], createdAt: 2,
};
const receipt: TaskPhaseRunReceiptInfo = {
  id: "receipt-1", taskId: "task-1", transcriptSessionId: "session-1", sequence: 2,
  phase: "execution", acpSessionId: "acp-1", instruction: "Implement", status: "sent",
  stopReason: "end_turn", error: null, verificationStatus: "changed",
  verificationWorkspacePath: "/repo", verificationChangedFilesJson:
    JSON.stringify([{ status: "M", path: "packages/path/src/index.ts" }]),
  verificationError: null, createdAt: 1, updatedAt: 2,
};

describe("TaskActivityPanel", () => {
  it("leads with the completed result and keeps secondary detail collapsed", () => {
    render(<TaskActivityPanel task={task} artifacts={[artifact]} phaseReceipts={[receipt]}
      deliveryReadiness={null} recoveryNotice={null}
      optionalChecks={<p>Advisor controls</p>} auditTrail={<p>Exact prompts</p>}
      deliveryDetails={<p>Recent provenance</p>} />);

    expect(screen.getByRole("heading", { name: "Completed" })).toBeInTheDocument();
    expect(screen.getByText("4/4 phases complete")).toBeInTheDocument();
    expect(screen.getByText("Changes verified")).toBeInTheDocument();
    expect(screen.getByText("packages/path/src/index.ts")).toBeInTheDocument();
    expect(screen.getByText(/cache is bounded/)).toBeInTheDocument();
    expect(screen.getByText("Optional checks").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Audit trail").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Delivery details").closest("details")).not.toHaveAttribute("open");
  });

  it("describes an unfinished Task without inventing a result", () => {
    const inProgress = { ...task, status: "in_progress", currentPhase: "planning" as const,
      phases: task.phases.map((phase, index) => ({ ...phase, status: index === 0 ? "completed" : "pending" })) };
    render(<TaskActivityPanel task={inProgress} artifacts={[]} phaseReceipts={[]}
      deliveryReadiness={null} recoveryNotice={null} optionalChecks={null}
      auditTrail={null} deliveryDetails={null} />);

    expect(screen.getByRole("heading", { name: "planning in progress" })).toBeInTheDocument();
    expect(screen.getByText("1/4 phases complete")).toBeInTheDocument();
    expect(screen.getByText("No phase evidence has been saved yet.")).toBeInTheDocument();
    expect(screen.getByText("Not verified yet")).toBeInTheDocument();
  });
});
