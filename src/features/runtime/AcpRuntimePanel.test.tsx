import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AcpSessionInfo, TaskInfo } from "../../types/domain";
import { AcpRuntimePanel, type AcpRuntimePanelProps } from "./AcpRuntimePanel";

function props(overrides: Partial<AcpRuntimePanelProps> = {}): AcpRuntimePanelProps {
  return {
    activeTask: null, busy: false, canPreviewContext: false,
    canStartSelectedCandidate: true, canUseSession: false, expanded: true,
    prompt: "Keep this prompt", promptBusy: false, promptResult: null, session: null,
    permissions: [],
    showWaiting: false, statusLabel: "not started", onChangeModel: vi.fn(),
    onChangePrompt: vi.fn(), onDrain: vi.fn(), onPreviewContext: vi.fn(),
    onSendPrompt: vi.fn(), onStartSelected: vi.fn(),
    onStop: vi.fn(), onRespondPermission: vi.fn(), onToggleExpanded: vi.fn(), ...overrides,
  };
}

const session: AcpSessionInfo = {
  id: "acp-1", state: "running", pid: 10, cwd: "/repo", protocolVersion: 1,
  agentSessionId: "agent-1", agentName: "Codex", agentVersion: "1", exitCode: null,
  codingModel: {
    currentValue: "model-a",
    options: [
      { value: "model-a", name: "Model A", description: "Current model" },
      { value: "model-b", name: "Model B", description: null },
    ],
  },
};

const task: TaskInfo = {
  id: "task-1", projectId: "project-1", transcriptSessionId: "transcript-1",
  originalPrompt: "Refactor", status: "active", currentPhase: "analysis",
  initialComplexityProfile: "standard", initialComplexityReasons: ["Two layers"],
  initialComplexityConfidence: 70, complexityProfile: "complex",
  complexityReasons: ["Migration risk"], complexityConfidence: null,
  complexitySource: "user", complexityAssessmentVersion: "v1", phases: [],
  createdAt: 1, updatedAt: 1,
};

describe("ACP runtime panel", () => {
  it("renders inactive controls and forwards prompt/start/toggle actions", () => {
    const value = props({ canPreviewContext: true });
    render(<AcpRuntimePanel {...value} />);
    fireEvent.change(screen.getByLabelText("ACP prompt"), { target: { value: "Next" } });
    fireEvent.click(screen.getByRole("button", { name: "Start Selected ACP" }));
    fireEvent.click(screen.getByRole("button", { name: "Collapse ACP controls" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview Context" }));
    expect(value.onChangePrompt).toHaveBeenCalledWith("Next");
    expect(value.onStartSelected).toHaveBeenCalledOnce();
    expect(value.onToggleExpanded).toHaveBeenCalledOnce();
    expect(value.onPreviewContext).toHaveBeenCalledOnce();
  });

  it("keeps safety actions and prompt available while details are collapsed", () => {
    const value = props({ session, canUseSession: true, expanded: false });
    render(<AcpRuntimePanel {...value} />);
    expect(screen.getByRole("button", { name: "Drain ACP" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop ACP" })).toBeInTheDocument();
    expect(screen.getByLabelText("ACP prompt")).toHaveValue("Keep this prompt");
    expect(screen.queryByRole("combobox", { name: "Coding model" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Drain ACP" }));
    fireEvent.click(screen.getByRole("button", { name: "Stop ACP" }));
    expect(value.onDrain).toHaveBeenCalledOnce();
    expect(value.onStop).toHaveBeenCalledOnce();
  });

  it("forwards session-advertised model changes", () => {
    const value = props({ session, canUseSession: true });
    render(<AcpRuntimePanel {...value} />);
    fireEvent.change(screen.getByLabelText("Coding model"), { target: { value: "model-b" } });
    expect(value.onChangeModel).toHaveBeenCalledWith("model-b");
    expect(screen.getByText("Current model")).toBeInTheDocument();
  });

  it("offers every model advertised by the active agent", () => {
    render(<AcpRuntimePanel {...props({ session, canUseSession: true })} />);
    expect(screen.getByRole("option", { name: "Model B" })).toBeInTheDocument();
  });

  it("renders Task assessment and waiting/result state", () => {
    render(<AcpRuntimePanel {...props({ activeTask: task, promptResult: {
      sessionId: "acp-1", stopReason: "end_turn",
    }, showWaiting: true })} />);
    expect(screen.getByRole("heading", { name: "Task assessment" })).toBeInTheDocument();
    expect(screen.getByText("Migration risk")).toBeInTheDocument();
    expect(screen.getByText("User selected")).toBeInTheDocument();
    expect(screen.getByText("Stop reason: end_turn")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for agent response");
  });

  it("keeps permission choices visible while controls are collapsed", () => {
    const value = props({ expanded: false, permissions: [{ id: "permission-1", title: "Run tests",
      options: [{ optionId: "allow", name: "Allow once", kind: "allow_once" }] }] });
    render(<AcpRuntimePanel {...value} />); fireEvent.click(screen.getByRole("button", { name: "Allow once" }));
    expect(screen.getByText("Agent needs permission")).toBeInTheDocument();
    expect(value.onRespondPermission).toHaveBeenCalledWith("permission-1", "allow");
  });
});
