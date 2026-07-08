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

    if (command === "drain_session_output") {
      return Promise.resolve("");
    }

    return Promise.resolve(undefined);
  });
});

describe("PTY test panel", () => {
  it("renders fake and Codex PTY controls with agent doctor status", async () => {
    render(<App />);

    expect(screen.getByRole("main", { name: "AIadne PTY test" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "PTY Controls" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Fake" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Codex" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Interactive PTY terminal")).toBeInTheDocument();
    expect(screen.getByText("No output yet.")).toBeInTheDocument();
    expect(await screen.findByText("codex 1.2.3")).toBeInTheDocument();
    expect(screen.getByText("Install Claude Code and make sure `claude` is available on PATH."))
      .toBeInTheDocument();
  });

  it("writes xterm keyboard data to the active PTY session", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
      if (command === "list_agent_doctor_reports") {
        return Promise.resolve(defaultDoctorReports());
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

      return Promise.resolve("");
    });

    render(<App />);

    await screen.findByText("Install the Codex CLI and make sure `codex` is available on PATH.");
    expect(screen.getByRole("button", { name: "Start Codex" })).toBeDisabled();
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
      },
      status: "error",
      path: "/usr/bin/kimi",
      version: null,
      error: "version command failed",
      installHint: "Install Kimi CLI and make sure `kimi` is available on PATH.",
    },
  ];
}
