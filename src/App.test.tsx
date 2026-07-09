import { invoke } from "@tauri-apps/api/core";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

let onTerminalData: ((text: string) => void) | undefined;
const scrollToMock = vi.fn();

vi.mock("@xterm/xterm", () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    cols: 92,
    dispose: vi.fn(),
    focus: vi.fn(),
    loadAddon: vi.fn(),
    onData: vi.fn((handler) => {
      onTerminalData = handler;
      return { dispose: vi.fn() };
    }),
    open: vi.fn(),
    rows: 18,
    reset: vi.fn(),
    write: vi.fn(),
    writeln: vi.fn(),
  })),
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
  })),
}));

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollToMock,
  });
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn().mockImplementation(() => ({
      disconnect: vi.fn(),
      observe: vi.fn(),
    })),
  );
});

beforeEach(() => {
  onTerminalData = undefined;
  scrollToMock.mockClear();
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockImplementation((command) => {
    if (command === "list_projects") {
      return Promise.resolve(defaultProjects());
    }

    if (command === "list_transcript_sessions") {
      return Promise.resolve(defaultTranscriptSessions());
    }

    if (command === "create_transcript_session") {
      return Promise.resolve(defaultTranscriptSession());
    }

    if (command === "append_transcript_events") {
      return Promise.resolve([]);
    }

    if (command === "list_transcript_events") {
      return Promise.resolve([]);
    }

    if (command === "list_agent_doctor_reports") {
      return Promise.resolve(defaultDoctorReports());
    }

    if (command === "list_acp_registry_candidates") {
      return Promise.resolve(defaultAcpRegistryCandidates());
    }

    if (command === "drain_session_output") {
      return Promise.resolve("");
    }

    if (command === "drain_acp_events") {
      return Promise.resolve([]);
    }

    return Promise.resolve(undefined);
  });
});

describe("PTY test panel", () => {
  it("renders fake and Codex PTY controls with agent doctor status", async () => {
    render(<App />);

    expect(screen.getByRole("main", { name: "AIadne runtime test" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Runtime Controls" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Structured ACP" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Terminal PTY" }))
      .toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "Start Fake" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Fake ACP" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Selected ACP" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Workspace" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Session History" })).toBeInTheDocument();
    expect(screen.getByText("ACP Agents")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Project" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Interactive PTY terminal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("ACP Agents"));
    expect(screen.getByLabelText("ACP registry candidates")).toBeInTheDocument();
    expect(screen.getByLabelText("ACP prompt")).toBeInTheDocument();
    expect(await screen.findByText("No projects yet.")).toBeInTheDocument();
    expect(screen.getByText("No ACP events yet.")).toBeInTheDocument();
    expect(await screen.findByText("No saved sessions yet.")).toBeInTheDocument();
    expect(await screen.findAllByText("npx -y @agentclientprotocol/codex-acp@1.1.0"))
      .not.toHaveLength(0);
    expect(screen.getAllByText("Available through npx; first launch may download the ACP package."))
      .not.toHaveLength(0);
    expect(screen.getByText("Missing binary")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Terminal PTY" }));
    fireEvent.click(screen.getByText("PTY Agents"));

    expect(screen.getByRole("heading", { name: "PTY Controls" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Fake" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Codex" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Interactive PTY terminal")).toBeInTheDocument();
    expect(screen.getByText("No output yet.")).toBeInTheDocument();
    expect(screen.queryByText("No ACP events yet.")).not.toBeInTheDocument();
    expect(await screen.findByText("codex 1.2.3")).toBeInTheDocument();
    expect(screen.getByText("PTY: Supported · ACP: Unknown")).toBeInTheDocument();
    expect(screen.getByText("Install Claude Code and make sure `claude` is available on PATH."))
      .toBeInTheDocument();
  });

  it("creates and selects a project workspace", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "create_project") {
        return Promise.resolve(defaultProject());
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    await screen.findByText("No projects yet.");
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "AIadne" },
    });
    fireEvent.change(screen.getByLabelText("Project path"), {
      target: { value: "/home/katarina/projects/AIadne" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Project" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("create_project", {
        request: {
          name: "AIadne",
          path: "/home/katarina/projects/AIadne",
        },
      });
    });
    expect(await screen.findByText("/home/katarina/projects/AIadne")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select AIadne project" }))
      .toHaveAttribute("aria-pressed", "true");
  });

  it("renders saved ACP transcript sessions", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "list_transcript_sessions") {
        return Promise.resolve([
          defaultTranscriptSession({
            id: "transcript-old",
            title: "Older Codex ACP",
            eventCount: 3,
          }),
          defaultTranscriptSession({
            id: "transcript-new",
            title: "Newer Codex ACP",
            eventCount: 2,
            updatedAt: 1_785_000_010,
          }),
        ]);
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      if (command === "list_transcript_events") {
        return Promise.resolve(defaultTranscriptEvents());
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    expect(await screen.findByText("Older Codex ACP")).toBeInTheDocument();
    expect(screen.getByText("Codex · acp · 3 events")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Older Codex ACP transcript" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("list_transcript_events", {
        sessionId: "transcript-old",
      });
    });
    expect(await screen.findByRole("heading", { name: "Saved Transcript" })).toBeInTheDocument();
    expect(screen.getByText("old question")).toBeInTheDocument();
    expect(screen.getByText("old answer")).toBeInTheDocument();
    expect(screen.getByText("Question")).toBeInTheDocument();
    expect(screen.getByText("Answer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Older Codex ACP transcript" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Open Newer Codex ACP transcript" }))
      .toHaveAttribute("aria-pressed", "false");

    invokeMock.mockImplementation((command, args) => {
      if (command === "list_transcript_events") {
        const sessionId = (args as { sessionId: string }).sessionId;
        return Promise.resolve(
          sessionId === "transcript-new" ? defaultTranscriptEvents("new") : defaultTranscriptEvents(),
        );
      }

      return Promise.resolve([]);
    });

    fireEvent.click(screen.getByRole("button", { name: "Open Newer Codex ACP transcript" }));

    await waitFor(() => {
      expect(screen.getByText("new question")).toBeInTheDocument();
    });
    expect(screen.queryByText("old question")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Older Codex ACP transcript" }))
      .toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Open Newer Codex ACP transcript" }))
      .toHaveAttribute("aria-pressed", "true");
  });

  it("renders saved ACP transcript chunks as readable questions and answers", async () => {
    vi.mocked(invoke).mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "list_transcript_sessions") {
        return Promise.resolve([
          defaultTranscriptSession({
            id: "transcript-chunks",
            title: "Chunked Codex ACP",
            eventCount: 5,
          }),
        ]);
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "list_transcript_events") {
        return Promise.resolve([
          {
            id: "event-question",
            sessionId: "transcript-chunks",
            sequence: 0,
            kind: "user_message",
            content: "Can you explain this?",
            createdAt: 1_785_000_001,
          },
          {
            id: "event-answer-a",
            sessionId: "transcript-chunks",
            sequence: 1,
            kind: "agent_message",
            content: "Yes,",
            createdAt: 1_785_000_002,
          },
          {
            id: "event-answer-b",
            sessionId: "transcript-chunks",
            sequence: 2,
            kind: "agent_message",
            content: "this is the answer.",
            createdAt: 1_785_000_003,
          },
          {
            id: "event-next-question",
            sessionId: "transcript-chunks",
            sequence: 3,
            kind: "user_message",
            content: "And the next thing?",
            createdAt: 1_785_000_004,
          },
        ]);
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Open Chunked Codex ACP transcript" }));

    expect(await screen.findByText("Can you explain this?")).toBeInTheDocument();
    expect(screen.getByText("Yes, this is the answer.")).toBeInTheDocument();
    expect(screen.getByText("And the next thing?")).toBeInTheDocument();
    expect(screen.getAllByText("Question")).toHaveLength(2);
    expect(screen.getByText("Answer")).toBeInTheDocument();
  });

  it("passes the selected project cwd when launching a PTY session", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve([defaultProject()]);
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "start_fake_session") {
        return Promise.resolve({
          id: "session-with-cwd",
          state: "running",
          pid: 123,
          cols: 92,
          rows: 18,
          exitCode: null,
        });
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    await screen.findByText("/home/katarina/projects/AIadne");
    fireEvent.click(screen.getByRole("button", { name: "Terminal PTY" }));
    fireEvent.click(await screen.findByRole("button", { name: "Start Fake" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("start_fake_session", {
        request: {
          cols: 92,
          rows: 18,
          cwd: "/home/katarina/projects/AIadne",
        },
      });
    });
  });

  it("selects ACP registry candidates without launching them", async () => {
    const invokeMock = vi.mocked(invoke);

    render(<App />);

    fireEvent.click(await screen.findByText("ACP Agents"));
    const selectedCandidate = await screen.findByLabelText("Selected ACP candidate");
    expect(selectedCandidate).toHaveTextContent("Codex");

    fireEvent.click(screen.getByRole("button", { name: "Select Kimi CLI ACP candidate" }));

    expect(selectedCandidate).toHaveTextContent("Kimi CLI");
    expect(screen.getByRole("button", { name: "Select Kimi CLI ACP candidate" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Start Selected ACP" })).toBeDisabled();
    expect(invokeMock).not.toHaveBeenCalledWith("start_fake_acp_session", expect.anything());
  });

  it("starts the selected ACP registry candidate", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve([defaultProject()]);
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "start_acp_registry_session") {
        return Promise.resolve({
          id: "acp-session-2",
          state: "running",
          pid: 789,
          protocolVersion: 1,
          agentSessionId: "codex-acp-session",
          agentName: "codex-acp",
          agentVersion: "1.1.0",
          exitCode: null,
        });
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    fireEvent.click(await screen.findByText("ACP Agents"));
    await screen.findByLabelText("Selected ACP candidate");
    fireEvent.click(screen.getByRole("button", { name: "Start Selected ACP" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("start_acp_registry_session", {
        request: {
          candidateId: "codex-acp",
          cwd: "/home/katarina/projects/AIadne",
        },
      });
    });
    expect(await screen.findAllByText("Codex · running · codex-acp-session"))
      .not.toHaveLength(0);
  });

  it("starts a non-default launchable ACP registry candidate", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "start_acp_registry_session") {
        return Promise.resolve({
          id: "acp-session-gemini",
          state: "running",
          pid: 987,
          protocolVersion: 1,
          agentSessionId: "gemini-acp-session",
          agentName: "gemini-acp",
          agentVersion: "0.49.0",
          exitCode: null,
        });
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    fireEvent.click(await screen.findByText("ACP Agents"));
    await screen.findByLabelText("Selected ACP candidate");
    fireEvent.click(screen.getByRole("button", { name: "Select Gemini CLI ACP candidate" }));
    fireEvent.click(screen.getByRole("button", { name: "Start Selected ACP" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("start_acp_registry_session", {
        request: {
          candidateId: "gemini",
        },
      });
    });
    expect(await screen.findAllByText("Gemini CLI · running · gemini-acp-session"))
      .not.toHaveLength(0);
  });

  it("locks ACP candidate selection while a session is running", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "start_acp_registry_session") {
        return Promise.resolve({
          id: "acp-session-locked",
          state: "running",
          pid: 111,
          protocolVersion: 1,
          agentSessionId: "locked-acp-session",
          agentName: "codex-acp",
          agentVersion: "1.1.0",
          exitCode: null,
        });
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      return Promise.resolve("");
    });

    render(<App />);

    fireEvent.click(await screen.findByText("ACP Agents"));
    await screen.findByLabelText("Selected ACP candidate");
    fireEvent.click(screen.getByRole("button", { name: "Start Selected ACP" }));

    expect(await screen.findAllByText("Codex · running · locked-acp-session"))
      .not.toHaveLength(0);
    expect(screen.getByRole("button", { name: "Select Kimi CLI ACP candidate" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Select Gemini CLI ACP candidate" })).toBeDisabled();
  });

  it("writes xterm keyboard data to the active PTY session", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "start_fake_session") {
        return Promise.resolve({
          id: "session-1",
          state: "running",
          pid: 123,
          cols: 92,
          rows: 18,
          exitCode: null,
        });
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Terminal PTY" }));
    fireEvent.click(await screen.findByRole("button", { name: "Start Fake" }));

    expect(await screen.findAllByText("fake · running · 92x18")).not.toHaveLength(0);
    expect(invokeMock).toHaveBeenCalledWith("start_fake_session", {
      request: { cols: 92, rows: 18 },
    });

    expect(onTerminalData).toBeTypeOf("function");
    act(() => {
      onTerminalData?.("hello\r");
    });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("write_session_input", {
        sessionId: "session-1",
        text: "hello\r",
      });
    });
  });

  it("blocks Codex start when the CLI is missing", async () => {
    vi.mocked(invoke).mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports({ codexStatus: "missing" }));
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      return Promise.resolve("");
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Terminal PTY" }));
    await screen.findByText("Install the Codex CLI and make sure `codex` is available on PATH.");
    expect(screen.getByRole("button", { name: "Start Codex" })).toBeDisabled();
  });

  it("starts fake ACP and renders structured events", async () => {
    const invokeMock = vi.mocked(invoke);
    let promptSent = false;
    let eventDrained = false;
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "start_fake_acp_session") {
        return Promise.resolve({
          id: "acp-session-1",
          state: "running",
          pid: 456,
          protocolVersion: 1,
          agentSessionId: "fake-acp-session",
          agentName: "fake-acp",
          agentVersion: "0.1.0",
          exitCode: null,
        });
      }

      if (command === "create_transcript_session") {
        return Promise.resolve(defaultTranscriptSession());
      }

      if (command === "append_transcript_events") {
        return Promise.resolve([]);
      }

      if (command === "send_acp_prompt") {
        promptSent = true;
        return Promise.resolve({
          sessionId: "acp-session-1",
          stopReason: "end_turn",
        });
      }

      if (command === "drain_acp_events") {
        if (promptSent && !eventDrained) {
          eventDrained = true;
          return Promise.resolve([
            {
              kind: "agent_message",
              content: "fake acp received",
            },
            {
              kind: "agent_message",
              content: "prompt",
            },
          ]);
        }

        return Promise.resolve([]);
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start Fake ACP" }));
    expect(await screen.findAllByText("fake · running · fake-acp-session"))
      .not.toHaveLength(0);
    expect(invokeMock).toHaveBeenCalledWith("create_transcript_session", {
      request: {
        projectId: null,
        runtime: "acp",
        source: "fake",
        title: "Fake ACP",
      },
    });

    fireEvent.change(screen.getByLabelText("ACP prompt"), {
      target: { value: "hello acp" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send ACP" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("send_acp_prompt", {
        sessionId: "acp-session-1",
        prompt: "hello acp",
      });
    });
    expect(invokeMock).toHaveBeenCalledWith("append_transcript_events", {
      sessionId: "transcript-1",
      events: [{ kind: "user_message", content: "hello acp" }],
    });
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("append_transcript_events", {
        sessionId: "transcript-1",
        events: [{ kind: "agent_message", content: "fake acp received prompt" }],
      });
    });
    expect(await screen.findByText("fake acp received prompt")).toBeInTheDocument();
    expect(scrollToMock).toHaveBeenCalled();
    expect(await screen.findByText("Stop reason: end_turn")).toBeInTheDocument();
  });

  it("keeps ACP stop available while a prompt is in flight", async () => {
    const invokeMock = vi.mocked(invoke);
    let resolvePrompt: ((result: unknown) => void) | undefined;
    invokeMock.mockImplementation((command) => {
      if (command === "list_projects") {
        return Promise.resolve(defaultProjects());
      }

      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
      }

      if (command === "list_acp_registry_candidates") {
        return Promise.resolve(defaultAcpRegistryCandidates());
      }

      if (command === "start_fake_acp_session") {
        return Promise.resolve({
          id: "acp-session-1",
          state: "running",
          pid: 456,
          protocolVersion: 1,
          agentSessionId: "fake-acp-session",
          agentName: "fake-acp",
          agentVersion: "0.1.0",
          exitCode: null,
        });
      }

      if (command === "send_acp_prompt") {
        return new Promise((resolve) => {
          resolvePrompt = resolve;
        });
      }

      if (command === "drain_acp_events") {
        return Promise.resolve([]);
      }

      if (command === "drain_session_output") {
        return Promise.resolve("");
      }

      return Promise.resolve(undefined);
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start Fake ACP" }));
    expect(await screen.findAllByText("fake · running · fake-acp-session"))
      .not.toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Send ACP" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("send_acp_prompt", {
        sessionId: "acp-session-1",
        prompt: "Hello from AIadne",
      });
    });
    expect(screen.getByRole("button", { name: "Send ACP" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Drain ACP" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Stop ACP" })).not.toBeDisabled();

    resolvePrompt?.({
      sessionId: "acp-session-1",
      stopReason: "end_turn",
    });
    expect(await screen.findByText("Stop reason: end_turn")).toBeInTheDocument();
  });
});

function defaultProject() {
  return {
    id: "project-aiadne",
    name: "AIadne",
    path: "/home/katarina/projects/AIadne",
    createdAt: 1_785_000_000,
    updatedAt: 1_785_000_000,
  };
}

function defaultProjects() {
  return [];
}

function defaultTranscriptSession(overrides: Partial<ReturnType<typeof baseTranscriptSession>> = {}) {
  return {
    ...baseTranscriptSession(),
    ...overrides,
  };
}

function baseTranscriptSession() {
  return {
    id: "transcript-1",
    projectId: null,
    runtime: "acp",
    source: "Codex",
    title: "Codex ACP",
    startedAt: 1_785_000_001,
    updatedAt: 1_785_000_001,
    eventCount: 0,
  };
}

function defaultTranscriptSessions() {
  return [];
}

function defaultTranscriptEvents(prefix = "old") {
  return [
    {
      id: "transcript-event-1",
      sessionId: "transcript-1",
      sequence: 0,
      kind: "user_message",
      content: `${prefix} question`,
      createdAt: 1_785_000_002,
    },
    {
      id: "transcript-event-2",
      sessionId: "transcript-1",
      sequence: 1,
      kind: "agent_message",
      content: `${prefix} answer`,
      createdAt: 1_785_000_003,
    },
  ];
}

function defaultDoctorReports({
  codexStatus = "installed",
}: {
  codexStatus?: "installed" | "missing" | "error";
} = {}) {
  return [
    {
      adapter: {
        id: "codex",
        displayName: "Codex",
        executable: "codex",
        transports: {
          pty: "supported",
          acpStdio: "unknown",
        },
      },
      status: codexStatus,
      path: codexStatus === "missing" ? null : "/usr/bin/codex",
      version: codexStatus === "installed" ? "codex 1.2.3" : null,
      error: codexStatus === "error" ? "version failed" : null,
      installHint: "Install the Codex CLI and make sure `codex` is available on PATH.",
    },
    {
      adapter: {
        id: "claude_code",
        displayName: "Claude Code",
        executable: "claude",
        transports: {
          pty: "unknown",
          acpStdio: "unknown",
        },
      },
      status: "missing",
      path: null,
      version: null,
      error: null,
      installHint: "Install Claude Code and make sure `claude` is available on PATH.",
    },
    {
      adapter: {
        id: "kimi",
        displayName: "Kimi",
        executable: "kimi",
        transports: {
          pty: "unknown",
          acpStdio: "unknown",
        },
      },
      status: "error",
      path: "/usr/bin/kimi",
      version: null,
      error: "version command failed",
      installHint: "Install Kimi CLI and make sure `kimi` is available on PATH.",
    },
  ];
}

function defaultAcpRegistryCandidates() {
  return [
    {
      id: "codex-acp",
      name: "Codex",
      version: "1.1.0",
      description: "ACP adapter for OpenAI's coding assistant",
      distribution: "npx",
      status: "installable",
      command: ["npx", "-y", "@agentclientprotocol/codex-acp@1.1.0"],
      runnerPath: "/usr/bin/npx",
      installHint: "Available through npx; first launch may download the ACP package.",
      sourceUrl: "https://github.com/agentclientprotocol/codex-acp",
    },
    {
      id: "kimi",
      name: "Kimi CLI",
      version: "1.48.0",
      description: "Moonshot AI's coding assistant",
      distribution: "binary",
      status: "missing_binary",
      command: ["kimi", "acp"],
      runnerPath: null,
      installHint: "Install `kimi` and make sure it is available on PATH.",
      sourceUrl: "https://github.com/MoonshotAI/kimi-cli",
    },
    {
      id: "gemini",
      name: "Gemini CLI",
      version: "0.49.0",
      description: "Google's official CLI for Gemini",
      distribution: "npx",
      status: "installable",
      command: ["npx", "-y", "@google/gemini-cli@0.49.0", "--acp"],
      runnerPath: "/usr/bin/npx",
      installHint: "Available through npx; first launch may download the ACP package.",
      sourceUrl: "https://github.com/google-gemini/gemini-cli",
    },
  ];
}
