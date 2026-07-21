import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";
import { errorText } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type { RuntimeMode, SessionInfo } from "../../types/domain";

export interface TerminalSize { cols: number; rows: number }

interface UsePtyTerminalOptions {
  mode: RuntimeMode;
  output: string;
  session: SessionInfo | null;
  onError: (message: string) => void;
  onResizeSession: (sessionId: string, size: TerminalSize) => void;
}

const initialSize: TerminalSize = { cols: 80, rows: 24 };

export function usePtyTerminal({ mode, output, session, onError, onResizeSession }: UsePtyTerminalOptions) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef(session);
  const outputRef = useRef(output);
  const onErrorRef = useRef(onError);
  const onResizeSessionRef = useRef(onResizeSession);
  const [size, setSize] = useState<TerminalSize>(initialSize);

  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { outputRef.current = output; }, [output]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onResizeSessionRef.current = onResizeSession; }, [onResizeSession]);

  useEffect(() => {
    if (mode !== "pty" || !elementRef.current) return;
    const terminal = new Terminal({ cursorBlink: true, convertEol: true,
      fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace', fontSize: 13,
      scrollback: 1_000, theme: { background: "#111c18", foreground: "#d7ede3",
        cursor: "#d7ede3", selectionBackground: "#31584d" } });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon); terminal.open(elementRef.current); fitAddon.fit();
    setSize(readTerminalSize(terminal));
    if (outputRef.current.length > 0) terminal.write(outputRef.current); else terminal.writeln("No session yet.");
    terminalRef.current = terminal; fitAddonRef.current = fitAddon;

    const inputDisposable = terminal.onData((text) => {
      const activeSession = sessionRef.current;
      if (!activeSession || activeSession.state !== "running") return;
      void invokeCommand("write_session_input", { sessionId: activeSession.id, text })
        .catch((error) => onErrorRef.current(errorText(error)));
    });
    const resizeObserver = new ResizeObserver(() => {
      fitAddonRef.current?.fit();
      const nextSize = readTerminalSize(terminal); setSize(nextSize);
      const activeSession = sessionRef.current;
      if (activeSession?.state === "running" &&
        (activeSession.cols !== nextSize.cols || activeSession.rows !== nextSize.rows)) {
        onResizeSessionRef.current(activeSession.id, nextSize);
      }
    });
    resizeObserver.observe(elementRef.current);
    return () => { inputDisposable.dispose(); resizeObserver.disconnect(); terminal.dispose();
      terminalRef.current = null; fitAddonRef.current = null; };
  }, [mode]);

  function fit(): TerminalSize {
    fitAddonRef.current?.fit();
    const nextSize = readTerminalSize(terminalRef.current); setSize(nextSize); return nextSize;
  }

  return { elementRef, size, fit, focus: () => terminalRef.current?.focus(),
    reset: () => terminalRef.current?.reset(), write: (text: string) => terminalRef.current?.write(text) };
}

function readTerminalSize(terminal: Terminal | null): TerminalSize {
  return { cols: Math.max(1, terminal?.cols ?? initialSize.cols),
    rows: Math.max(1, terminal?.rows ?? initialSize.rows) };
}
