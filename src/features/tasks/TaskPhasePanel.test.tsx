import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskInfo, TaskPhaseArtifactInfo, TranscriptEventInfo } from "../../types/domain";
import { TaskPhasePanel } from "./TaskPhasePanel";

const phases: TaskInfo["phases"] = ["analysis", "planning", "execution", "review"].map((phase, index) => ({
  id: `p${index}`, taskId: "t1", phase: phase as TaskInfo["currentPhase"], phaseIndex: index,
  status: index === 0 ? "in_progress" : "pending", startedAt: index === 0 ? 1 : null, completedAt: null }));
const task: TaskInfo = { id: "t1", projectId: "project", transcriptSessionId: "s1", originalPrompt: "Fix",
  status: "in_progress", currentPhase: "analysis", initialComplexityProfile: "standard",
  initialComplexityReasons: [], initialComplexityConfidence: 50, complexityProfile: "standard",
  complexityReasons: [], complexityConfidence: 50, complexitySource: "system",
  complexityAssessmentVersion: "v1", phases, createdAt: 1, updatedAt: 1 };
const event: TranscriptEventInfo = { id: "e1", sessionId: "s1", sequence: 0, kind: "agent_message",
  content: "Found the boundary", createdAt: 1 };
const artifact: TaskPhaseArtifactInfo = { id: "a1", taskId: "t1", phase: "analysis", sequence: 0,
  kind: "summary", content: "Analysis evidence", sourceTranscriptEventIds: ["e1"], createdAt: 1 };
function props(overrides = {}) { return { task, artifacts: [], currentPhase: phases[0], sourceEvents: [event],
  selectedSourceIds: [], kind: "summary", content: "", error: null, loading: false,
  canRunAgent: true, agentRunning: false,
  onChangeKind: vi.fn(), onChangeContent: vi.fn(), onToggleSource: vi.fn(), onCreateArtifact: vi.fn(),
  onStart: vi.fn(), onComplete: vi.fn(), onRunAgent: vi.fn(), onDraftLatestAgentResponseEvidence: vi.fn(), ...overrides }; }

describe("TaskPhasePanel", () => {
  it("renders phase state and forwards evidence form changes", () => {
    const value = props(); render(<TaskPhasePanel {...value} />);
    expect(screen.getByRole("heading", { name: "Task phases" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Artifact kind"), { target: { value: "risk" } });
    fireEvent.change(screen.getByLabelText("Phase evidence"), { target: { value: "Risk found" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Found the boundary/ }));
    expect(value.onChangeKind).toHaveBeenCalledWith("risk"); expect(value.onChangeContent).toHaveBeenCalledWith("Risk found");
    expect(value.onToggleSource).toHaveBeenCalledWith("e1", true);
  });
  it("locks completion without an artifact and enables it with persisted evidence", () => {
    const value = props(); const view = render(<TaskPhasePanel {...value} />);
    expect(screen.getByRole("button", { name: "Complete analysis" })).toBeDisabled();
    view.rerender(<TaskPhasePanel {...props({ artifacts: [artifact] })} />);
    expect(screen.getByRole("button", { name: "Complete analysis" })).toBeEnabled();
    expect(screen.getByText("Analysis evidence")).toBeInTheDocument();
  });
  it("offers start only for a pending current phase and surfaces errors", () => {
    const pending = { ...phases[0], status: "pending", startedAt: null }; const value = props({ currentPhase: pending,
      error: "Gate failed" }); render(<TaskPhasePanel {...value} />);
    fireEvent.click(screen.getByRole("button", { name: "Start analysis" }));
    expect(value.onStart).toHaveBeenCalledOnce(); expect(screen.getByRole("alert")).toHaveTextContent("Gate failed");
  });
  it("shows the exact bounded instruction and runs only an in-progress phase", () => {
    const value = props(); render(<TaskPhasePanel {...value} />);
    fireEvent.click(screen.getByText("Exact agent instruction"));
    expect(screen.getByText(/Run only the analysis phase/)).toHaveTextContent(task.originalPrompt);
    fireEvent.click(screen.getByRole("button", { name: "Run analysis phase" }));
    expect(value.onRunAgent).toHaveBeenCalledWith(expect.stringContaining("Do not complete the phase"));
  });
  it("locks agent execution without a usable ACP session", () => {
    render(<TaskPhasePanel {...props({ canRunAgent: false })} />);
    expect(screen.getByRole("button", { name: "Run analysis phase" })).toBeDisabled();
    expect(screen.getByText("Start an ACP session to run this phase.")).toBeInTheDocument();
  });
  it("offers explicit latest persisted agent-response provenance selection", () => {
    const value = props(); render(<TaskPhasePanel {...value} />);
    fireEvent.click(screen.getByRole("button", { name: "Draft evidence from latest agent response" }));
    expect(value.onDraftLatestAgentResponseEvidence).toHaveBeenCalledOnce();
  });
});
