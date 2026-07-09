import { invoke } from "@tauri-apps/api/core";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

let onTerminalData: ((text: string) => void) | undefined;

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
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockImplementation((command) => {
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
    expect(screen.getByRole("heading", { name: "PTY Controls" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Fake" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Codex" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Fake ACP" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Selected ACP" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Interactive PTY terminal")).toBeInTheDocument();
    expect(screen.getByLabelText("ACP registry candidates")).toBeInTheDocument();
    expect(screen.getByLabelText("ACP prompt")).toBeInTheDocument();
    expect(screen.getByText("No output yet.")).toBeInTheDocument();
    expect(screen.getByText("No ACP events yet.")).toBeInTheDocument();
    expect(await screen.findByText("codex 1.2.3")).toBeInTheDocument();
    expect(await screen.findAllByText("npx -y @agentclientprotocol/codex-acp@1.1.0"))
      .not.toHaveLength(0);
    expect(screen.getAllByText("Available through npx; first launch may download the ACP package."))
      .not.toHaveLength(0);
    expect(screen.getByText("Missing binary")).toBeInTheDocument();
    expect(screen.getByText("PTY: Supported · ACP: Unknown")).toBeInTheDocument();
    expect(screen.getByText("Install Claude Code and make sure `claude` is available on PATH."))
      .toBeInTheDocument();
  });

  it("selects ACP registry candidates without launching them", async () => {
    const invokeMock = vi.mocked(invoke);

    render(<App />);

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

    await screen.findByLabelText("Selected ACP candidate");
    fireEvent.click(screen.getByRole("button", { name: "Start Selected ACP" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("start_acp_registry_session", {
        request: {
          candidateId: "codex-acp",
        },
      });
    });
    expect(await screen.findByText("Codex · running · codex-acp-session")).toBeInTheDocument();
  });

  it("starts a non-default launchable ACP registry candidate", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
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
    expect(await screen.findByText("Gemini CLI · running · gemini-acp-session"))
      .toBeInTheDocument();
  });

  it("locks ACP candidate selection while a session is running", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
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

    await screen.findByLabelText("Selected ACP candidate");
    fireEvent.click(screen.getByRole("button", { name: "Start Selected ACP" }));

    expect(await screen.findByText("Codex · running · locked-acp-session")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Kimi CLI ACP candidate" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Select Gemini CLI ACP candidate" })).toBeDisabled();
  });

  it("writes xterm keyboard data to the active PTY session", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
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

    fireEvent.click(screen.getByRole("button", { name: "Start Fake" }));

    await screen.findByText("fake · running · 92x18");
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

    await screen.findByText("Install the Codex CLI and make sure `codex` is available on PATH.");
    expect(screen.getByRole("button", { name: "Start Codex" })).toBeDisabled();
  });

  it("starts fake ACP and renders structured events", async () => {
    const invokeMock = vi.mocked(invoke);
    let promptSent = false;
    let eventDrained = false;
    invokeMock.mockImplementation((command) => {
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
              content: "fake acp received prompt",
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
    await screen.findByText("fake · running · fake-acp-session");

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
    expect(await screen.findByText("fake acp received prompt")).toBeInTheDocument();
    expect(await screen.findByText("Stop reason: end_turn")).toBeInTheDocument();
  });

  it("keeps ACP stop available while a prompt is in flight", async () => {
    const invokeMock = vi.mocked(invoke);
    let resolvePrompt: ((result: unknown) => void) | undefined;
    invokeMock.mockImplementation((command) => {
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
    await screen.findByText("fake · running · fake-acp-session");

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
