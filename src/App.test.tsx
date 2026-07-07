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
});

describe("PTY test panel", () => {
  it("renders fake and Codex PTY controls with an interactive terminal", () => {
    render(<App />);

    expect(screen.getByRole("main", { name: "AIadne PTY test" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "PTY Controls" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Fake" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Codex" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Interactive PTY terminal")).toBeInTheDocument();
    expect(screen.getByText("No output yet.")).toBeInTheDocument();
  });

  it("writes xterm keyboard data to the active PTY session", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation((command) => {
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

      if (command === "drain_session_output") {
        return Promise.resolve("");
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
});
