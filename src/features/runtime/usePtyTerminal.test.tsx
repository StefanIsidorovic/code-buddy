import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionInfo } from "../../types/domain";

const doubles = vi.hoisted(() => ({ invoke: vi.fn(), input: undefined as ((text: string) => void) | undefined,
  resize: undefined as (() => void) | undefined, dispose: vi.fn(), inputDispose: vi.fn(),
  disconnect: vi.fn(), fit: vi.fn(), focus: vi.fn(), reset: vi.fn(), write: vi.fn(), writeln: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: doubles.invoke }));
vi.mock("@xterm/xterm", () => ({ Terminal: vi.fn().mockImplementation(() => ({ cols: 92, rows: 18,
  dispose: doubles.dispose, focus: doubles.focus, loadAddon: vi.fn(), open: vi.fn(), reset: doubles.reset,
  write: doubles.write, writeln: doubles.writeln, onData: vi.fn((handler) => { doubles.input = handler;
    return { dispose: doubles.inputDispose }; }) })) }));
vi.mock("@xterm/addon-fit", () => ({ FitAddon: vi.fn().mockImplementation(() => ({ fit: doubles.fit })) }));

import { usePtyTerminal } from "./usePtyTerminal";

const running: SessionInfo = { id: "s1", state: "running", pid: 10, cwd: "/work", cols: 80,
  rows: 24, exitCode: null };

function Harness({ session = running, output = "ready" }: { session?: SessionInfo | null; output?: string }) {
  const terminal = usePtyTerminal({ mode: "pty", output, session, onError: vi.fn(), onResizeSession: vi.fn() });
  return <><div ref={terminal.elementRef} /><span>{terminal.size.cols}x{terminal.size.rows}</span>
    <button onClick={terminal.focus}>focus</button><button onClick={terminal.reset}>reset</button>
    <button onClick={() => terminal.write("next")}>write</button></>;
}

describe("usePtyTerminal", () => {
  beforeEach(() => { for (const value of Object.values(doubles)) if (typeof value === "function" && "mockReset" in value) value.mockReset();
    doubles.invoke.mockResolvedValue(undefined); doubles.input = undefined; doubles.resize = undefined;
    vi.stubGlobal("ResizeObserver", vi.fn().mockImplementation((callback) => { doubles.resize = callback;
      return { observe: vi.fn(), disconnect: doubles.disconnect }; })); });

  it("mounts output, tracks dimensions, forwards running input, and exposes terminal operations", async () => {
    const view = render(<Harness />);
    await waitFor(() => expect(screen.getByText("92x18")).toBeInTheDocument());
    expect(doubles.write).toHaveBeenCalledWith("ready");
    act(() => doubles.input?.("ls\n"));
    expect(doubles.invoke).toHaveBeenCalledWith("write_session_input", { sessionId: "s1", text: "ls\n" });
    screen.getByRole("button", { name: "focus" }).click(); screen.getByRole("button", { name: "reset" }).click();
    screen.getByRole("button", { name: "write" }).click();
    expect(doubles.focus).toHaveBeenCalled(); expect(doubles.reset).toHaveBeenCalled();
    expect(doubles.write).toHaveBeenCalledWith("next");
    view.unmount(); expect(doubles.inputDispose).toHaveBeenCalled(); expect(doubles.disconnect).toHaveBeenCalled();
    expect(doubles.dispose).toHaveBeenCalled();
  });

  it("shows the empty message and ignores input without a running session", async () => {
    render(<Harness session={null} output="" />);
    await waitFor(() => expect(doubles.writeln).toHaveBeenCalledWith("No session yet."));
    act(() => doubles.input?.("ignored")); expect(doubles.invoke).not.toHaveBeenCalled();
  });

  it("does not mount a terminal after the PTY lifecycle is disposed during loading", async () => {
    const view = render(<Harness />);
    view.unmount();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(doubles.write).not.toHaveBeenCalled();
    expect(doubles.writeln).not.toHaveBeenCalled();
    expect(doubles.dispose).not.toHaveBeenCalled();
  });
});
