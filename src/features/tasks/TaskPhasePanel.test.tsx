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
  canRunAgent: true, agentRunning: false, evidenceReviewed: false,
  onChangeKind: vi.fn(), onChangeContent: vi.fn(), onToggleSource: vi.fn(), onCreateArtifact: vi.fn(),
  onStart: vi.fn(), onComplete: vi.fn(), onRunAndPrepare: vi.fn(), onPrepareCompletion: vi.fn(),
  onAcknowledgeEvidenceReview: vi.fn(), ...overrides }; }

describe("TaskPhasePanel", () => {
  it("renders phase state and forwards evidence form changes", () => {
    const value = props(); render(<TaskPhasePanel {...value} />);
    expect(screen.getByRole("heading", { name: "Task phases" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Artifact kind"), { target: { value: "risk" } });
    fireEvent.change(screen.getByLabelText("Phase evidence"), { target: { value: "Risk found" } });
    fireEvent.click(screen.getByText("Transcript provenance"));
    fireEvent.click(screen.getByRole("checkbox", { name: /Found the boundary/ }));
    expect(value.onChangeKind).toHaveBeenCalledWith("risk"); expect(value.onChangeContent).toHaveBeenCalledWith("Risk found");
    expect(value.onToggleSource).toHaveBeenCalledWith("e1", true);
  });
  it("locks completion without an artifact and enables it with persisted evidence", () => {
    const value = props(); const view = render(<TaskPhasePanel {...value} />);
    expect(screen.getByRole("button", { name: "Complete analysis & show planning" })).toBeDisabled();
    view.rerender(<TaskPhasePanel {...props({ artifacts: [artifact], evidenceReviewed: true })} />);
    expect(screen.getByRole("button", { name: "Complete analysis & show planning" })).toBeEnabled();
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
    fireEvent.click(screen.getByRole("button", { name: "Run & prepare analysis" }));
    expect(value.onRunAndPrepare).toHaveBeenCalledWith(expect.stringContaining("Do not complete the phase"));
  });
  it("locks agent execution without a usable ACP session", () => {
    render(<TaskPhasePanel {...props({ canRunAgent: false })} />);
    expect(screen.getByRole("button", { name: "Run & prepare analysis" })).toBeDisabled();
    expect(screen.getByText("Start an ACP session to run this phase.")).toBeInTheDocument();
  });
  it("offers explicit completion preparation without claiming persistence", () => {
    const value = props(); render(<TaskPhasePanel {...value} />);
    fireEvent.click(screen.getByRole("button", { name: "Prepare completion" }));
    expect(value.onPrepareCompletion).toHaveBeenCalledOnce();
    expect(screen.getByText(/does not save evidence or complete the phase/)).toBeInTheDocument();
  });
  it("keeps transcript provenance compact until explicitly opened", () => {
    render(<TaskPhasePanel {...props({ selectedSourceIds: ["e1"] })} />);
    const disclosure = screen.getByText("Transcript provenance").closest("details");
    expect(disclosure).not.toHaveAttribute("open");
    expect(screen.getByText("1 selected · 1 persisted event(s)")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Transcript provenance"));
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getByText("#1 · agent message")).toBeInTheDocument();
  });
  it("requires explicit phase-aware evidence review before completion", () => {
    const value = props({ artifacts: [artifact] }); const view = render(<TaskPhasePanel {...value} />);
    expect(screen.getByText("Risks and unknowns are explicit.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete analysis & show planning" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /I reviewed the persisted evidence/ }));
    expect(value.onAcknowledgeEvidenceReview).toHaveBeenCalledWith(true);
    view.rerender(<TaskPhasePanel {...props({ artifacts: [artifact], evidenceReviewed: true })} />);
    expect(screen.getByRole("button", { name: "Complete analysis & show planning" })).toBeEnabled();
  });
  it("finishes the Task instead of promising a phase after review", () => {
    const reviewPhase = { ...phases[3], status: "in_progress", startedAt: 2 };
    const reviewTask = { ...task, currentPhase: "review" as const,
      phases: phases.map((phase) => phase.phase === "review" ? reviewPhase : phase) };
    render(<TaskPhasePanel {...props({ task: reviewTask, currentPhase: reviewPhase,
      artifacts: [{ ...artifact, phase: "review" }], evidenceReviewed: true })} />);
    expect(screen.getByRole("button", { name: "Complete review & finish task" })).toBeEnabled();
  });
});
