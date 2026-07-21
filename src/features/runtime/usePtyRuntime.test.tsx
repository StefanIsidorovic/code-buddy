import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionInfo } from "../../types/domain";

const doubles = vi.hoisted(() => ({
  invoke: vi.fn(),
  fit: vi.fn(() => ({ cols: 92, rows: 18 })),
  focus: vi.fn(),
  reset: vi.fn(),
  write: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: doubles.invoke }));
vi.mock("./usePtyTerminal", () => ({
  usePtyTerminal: vi.fn(() => ({
    elementRef: { current: null },
    size: { cols: 92, rows: 18 },
    fit: doubles.fit,
    focus: doubles.focus,
    reset: doubles.reset,
    write: doubles.write,
  })),
}));
import { usePtyRuntime } from "./usePtyRuntime";

const running: SessionInfo = {
  id: "s1",
  state: "running",
  pid: 10,
  cwd: "/repo",
  cols: 92,
  rows: 18,
  exitCode: null,
};

function setup(canStartCodex = true) {
  const runAction = vi.fn(async (action: () => Promise<void>) => action());
  const reportError = vi.fn();
  return {
    runAction,
    reportError,
    ...renderHook(() => usePtyRuntime({
      mode: "pty",
      cwd: "/repo",
      canStartCodex,
      runAction,
      reportError,
    })),
  };
}

describe("usePtyRuntime", () => {
  beforeEach(() => {
    for (const value of Object.values(doubles)) value.mockClear();
  });

  it("starts a fitted PTY session, resets the terminal, and drains initial output", async () => {
    doubles.invoke.mockImplementation((command) => command === "start_fake_session"
      ? Promise.resolve(running)
      : command === "drain_session_output" ? Promise.resolve("ready\n") : Promise.resolve(undefined));
    const { result, unmount } = setup();
    await act(() => result.current.start("fake"));
    expect(doubles.invoke).toHaveBeenCalledWith("start_fake_session", {
      request: { cols: 92, rows: 18, cwd: "/repo" },
    });
    expect(doubles.reset).toHaveBeenCalled();
    expect(doubles.focus).toHaveBeenCalled();
    expect(doubles.write).toHaveBeenCalledWith("ready\n");
    expect(result.current.output).toBe("ready\n");
    unmount();
  });

  it("blocks Codex start when Agent Doctor has not confirmed the CLI", async () => {
    const { result, reportError } = setup(false);
    await act(() => result.current.start("codex"));
    expect(reportError).toHaveBeenCalledWith("Codex CLI is not ready. Check Agent Doctor.");
    expect(doubles.invoke).not.toHaveBeenCalled();
  });

  it("resizes and gracefully stops the active session with exact payloads", async () => {
    doubles.invoke.mockImplementation((command) => {
      if (command === "start_codex_session") return Promise.resolve(running);
      if (command === "resize_session") return Promise.resolve({ ...running, cols: 120, rows: 30 });
      if (command === "stop_session") return Promise.resolve({ ...running, state: "exited" });
      if (command === "drain_session_output") return Promise.resolve("");
      return Promise.resolve(undefined);
    });
    const { result, unmount } = setup();
    await act(() => result.current.start("codex"));
    doubles.fit.mockReturnValueOnce({ cols: 120, rows: 30 });
    await act(() => result.current.resize());
    expect(doubles.invoke).toHaveBeenCalledWith("resize_session", {
      sessionId: "s1", cols: 120, rows: 30,
    });
    await act(() => result.current.stop(false));
    expect(doubles.invoke).toHaveBeenCalledWith("stop_session", { sessionId: "s1", force: false });
    expect(result.current.session?.state).toBe("exited");
    unmount();
  });
});
