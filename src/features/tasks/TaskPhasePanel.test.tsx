import { fireEvent, render, screen, within } from "@testing-library/react";
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
  canRunAgent: true, agentRunning: false, hasPhaseRun: false, evidenceReviewed: false,
  workspaceVerification: null,
  onChangeKind: vi.fn(), onChangeContent: vi.fn(), onToggleSource: vi.fn(), onCreateArtifact: vi.fn(),
  onToggleAllSources: vi.fn(),
  onStart: vi.fn(), onComplete: vi.fn(), onRunAndPrepare: vi.fn(), onPrepareCompletion: vi.fn(),
  onAcknowledgeEvidenceReview: vi.fn(), ...overrides }; }

describe("TaskPhasePanel", () => {
  it("renders phase state and forwards evidence form changes", () => {
    const value = props(); render(<TaskPhasePanel {...value} />);
    expect(screen.getByRole("heading", { name: "Task phases" })).toBeInTheDocument();
    expect(screen.getByLabelText("Current phase guidance")).toContainElement(screen.getByRole("status"));
    expect(document.querySelector(".task-next-step")).not.toBeInTheDocument();
    expect(screen.getByText("Step 2 · Save evidence")).toBeInTheDocument();
    expect(screen.getByText("Step 3 · Review evidence")).toBeInTheDocument();
    expect(screen.getByText("Step 4 · Complete phase")).toBeInTheDocument();
    expect(screen.getByText(/Classifies this saved phase result/)).toHaveClass("task-helper-card");
    expect(screen.getByText(/The durable conclusion for this phase/)).toHaveClass("task-helper-card");
    fireEvent.change(screen.getByLabelText(/Evidence type/), { target: { value: "risk" } });
    fireEvent.change(screen.getByLabelText(/^Phase evidence/), { target: { value: "Risk found" } });
    fireEvent.click(screen.getByText("Transcript provenance"));
    fireEvent.click(screen.getByRole("checkbox", { name: /Found the boundary/ }));
    expect(value.onChangeKind).toHaveBeenCalledWith("risk"); expect(value.onChangeContent).toHaveBeenCalledWith("Risk found");
    expect(value.onToggleSource).toHaveBeenCalledWith("e1", true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all persisted events" }));
    expect(value.onToggleAllSources).toHaveBeenCalledWith(true);
  });
  it("explains the Task operating model without implying automatic completion", () => {
    render(<TaskPhasePanel {...props()} />);
    fireEvent.click(screen.getByText("How this Task works"));
    expect(screen.getByText(/output stays visible beside every view/)).toBeInTheDocument();
    expect(screen.getByText("Use this view to save evidence, review it, and complete one phase at a time.")).toBeInTheDocument();
    expect(screen.getByText(/Run the agent for this phase, or write evidence manually/)).toBeInTheDocument();
    expect(screen.getByText(/read-only advisor\/reviewer reports/)).toBeInTheDocument();
  });
  it("locks completion without an artifact and enables it with persisted evidence", () => {
    const value = props(); const view = render(<TaskPhasePanel {...value} />);
    expect(screen.getByRole("button", { name: "Complete analysis & show planning" })).toBeDisabled();
    expect(screen.getByText(/Save phase evidence before reviewing/)).toHaveClass("task-helper-card");
    view.rerender(<TaskPhasePanel {...props({ artifacts: [artifact], evidenceReviewed: true })} />);
    expect(screen.getByRole("button", { name: "Complete analysis & show planning" })).toBeEnabled();
    expect(within(screen.getByLabelText("Current phase artifacts"))
      .getByText("Analysis evidence")).toBeInTheDocument();
  });
  it("offers start only for a pending current phase and surfaces errors", () => {
    const pending = { ...phases[0], status: "pending", startedAt: null }; const value = props({ currentPhase: pending,
      error: "Gate failed" }); render(<TaskPhasePanel {...value} />);
    fireEvent.click(screen.getByRole("button", { name: "Start analysis" }));
    expect(value.onStart).toHaveBeenCalledOnce(); expect(screen.getByRole("alert")).toHaveTextContent("Gate failed");
  });
  it("shows completed phases as read-only history and returns to the current phase", () => {
    const planningPhase = { ...phases[1], status: "in_progress" as const, startedAt: 2 };
    const completedAnalysis = { ...phases[0], status: "completed" as const, completedAt: 2 };
    const planningTask = { ...task, currentPhase: "planning" as const,
      phases: [completedAnalysis, planningPhase, phases[2], phases[3]] };
    render(<TaskPhasePanel {...props({ task: planningTask, currentPhase: planningPhase,
      artifacts: [artifact] })} />);
    fireEvent.click(screen.getByRole("button", { name: "analysis completed" }));
    expect(screen.getByLabelText("analysis phase history")).toHaveTextContent("Analysis evidence");
    expect(screen.getByText(/Read-only completed phase/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run agent for planning" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "planning in_progress" }));
    expect(screen.getByRole("button", { name: "Run agent for planning" })).toBeInTheDocument();
  });
  it("shows the exact bounded instruction and runs only an in-progress phase", () => {
    const value = props(); render(<TaskPhasePanel {...value} />);
    fireEvent.click(screen.getByText("Exact agent instruction"));
    expect(screen.getByText(/Run only the analysis phase/)).toHaveTextContent(task.originalPrompt);
    expect(screen.getByText("Step 1 · Create phase evidence")).toBeInTheDocument();
    expect(screen.getByText(/Skip the agent and write evidence directly below/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run agent for analysis" }));
    expect(value.onRunAndPrepare).toHaveBeenCalledWith(expect.stringContaining("Do not complete the phase"));
  });
  it("locks agent execution without a usable ACP session", () => {
    render(<TaskPhasePanel {...props({ canRunAgent: false })} />);
    expect(screen.getByRole("button", { name: "Run agent for analysis" })).toBeDisabled();
    expect(screen.getByText("Start an ACP session to run this phase.")).toBeInTheDocument();
  });
  it("offers explicit completion preparation without claiming persistence", () => {
    const value = props(); const view = render(<TaskPhasePanel {...value} />);
    expect(screen.queryByRole("button", { name: "Restore latest agent draft" })).not.toBeInTheDocument();
    view.rerender(<TaskPhasePanel {...value} hasPhaseRun />);
    fireEvent.click(screen.getByRole("button", { name: "Restore latest agent draft" }));
    expect(value.onPrepareCompletion).toHaveBeenCalledOnce();
    expect(screen.getByText(/Reloads the latest linked agent response/)).toBeInTheDocument();
  });
  it("opens transcript provenance when a run or selection makes it the next step", () => {
    render(<TaskPhasePanel {...props({ selectedSourceIds: ["e1"] })} />);
    const disclosure = screen.getByText("Transcript provenance").closest("details");
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getByText("1 selected · 1 persisted event(s)")).toBeInTheDocument();
    expect(screen.getByText("#1 · agent message")).toBeInTheDocument();
  });
  it("explains every requirement and enables Save only when draft and provenance are ready", () => {
    const value = props({ hasPhaseRun: true }); const view = render(<TaskPhasePanel {...value} />);
    expect(screen.getByText(/Review the prepared evidence text/)).toBeInTheDocument();
    expect(screen.getByText("Evidence text: required")).toBeInTheDocument();
    expect(screen.getByText("Transcript provenance: select at least one event")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save phase evidence" })).toBeDisabled();
    expect(screen.getByRole("note")).toHaveTextContent(/add evidence text and select/);
    view.rerender(<TaskPhasePanel {...props({ hasPhaseRun: true, content: "Analysis result",
      selectedSourceIds: ["e1"] })} />);
    expect(screen.getByText("Evidence text: ready")).toBeInTheDocument();
    expect(screen.getByText("Transcript provenance: 1 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save phase evidence" })).toBeEnabled();
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
  it("separates execution prose from repository verification and blocks an unchanged run", () => {
    const executionPhase = { ...phases[2], status: "in_progress" as const, startedAt: 2 };
    const executionTask = { ...task, currentPhase: "execution" as const,
      phases: phases.map((phase) => phase.phase === "execution" ? executionPhase : phase) };
    const executionArtifact = { ...artifact, phase: "execution" as const };
    const verification = { taskId: "t1", phase: "execution" as const, workspacePath: "/repo",
      status: "unchanged" as const, changedFiles: [], error: null };
    const view = render(<TaskPhasePanel {...props({ task: executionTask, currentPhase: executionPhase,
      artifacts: [executionArtifact], evidenceReviewed: true, hasPhaseRun: true,
      workspaceVerification: verification })} />);
    expect(screen.getByText("No repository change detected")).toBeInTheDocument();
    expect(screen.getByText("Workspace: /repo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete execution & show review" })).toBeDisabled();
    view.rerender(<TaskPhasePanel {...props({ task: executionTask, currentPhase: executionPhase,
      artifacts: [executionArtifact], evidenceReviewed: true, hasPhaseRun: true,
      workspaceVerification: { ...verification, status: "changed",
        changedFiles: [{ status: "M", path: "src/index.ts" }] } })} />);
    expect(screen.getByText("Repository changes verified")).toBeInTheDocument();
    expect(screen.getByText("src/index.ts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete execution & show review" })).toBeEnabled();
  });
  it("locks a repeated phase run after a successful receipt", () => {
    render(<TaskPhasePanel {...props({ hasPhaseRun: true })} />);
    expect(screen.getByRole("button", { name: "analysis agent run finished" })).toBeDisabled();
  });
});
