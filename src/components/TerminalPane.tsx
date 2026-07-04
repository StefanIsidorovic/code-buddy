import "@xterm/xterm/css/xterm.css";
import { Monitor } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Terminal as XTerm } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import type { RuntimeSession } from "../lib/types";

interface TerminalPaneProps {
  session: RuntimeSession | null;
  output: string;
  rawInput: boolean;
  onRawData: (text: string) => void;
  onResize: (cols: number, rows: number) => void;
}

export function TerminalPane({
  session,
  output,
  rawInput,
  onRawData,
  onResize,
}: TerminalPaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const writtenLengthRef = useRef(0);
  const rawInputRef = useRef(rawInput);
  const onRawDataRef = useRef(onRawData);
  const onResizeRef = useRef(onResize);

  useEffect(() => {
    rawInputRef.current = rawInput;
    onRawDataRef.current = onRawData;
    onResizeRef.current = onResize;
  }, [rawInput, onRawData, onResize]);

  useEffect(() => {
    if (!session || import.meta.env.MODE === "test") {
      return;
    }

    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    async function openTerminal() {
      const host = hostRef.current;
      if (!host) {
        return;
      }

      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (disposed) {
        return;
      }

      const terminal = new Terminal({
        convertEol: true,
        cursorBlink: true,
        fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
        fontSize: 13,
        lineHeight: 1.35,
        theme: {
          background: "#101820",
          foreground: "#dce7ed",
          cursor: "#f2c14e",
          selectionBackground: "#294b5a",
        },
      });
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(host);
      terminal.onData((data) => {
        if (rawInputRef.current) {
          onRawDataRef.current(data);
        }
      });

      try {
        const { WebglAddon } = await import("@xterm/addon-webgl");
        if (!disposed) {
          terminal.loadAddon(new WebglAddon());
        }
      } catch {
        // Canvas renderer remains the reliable fallback on older webviews.
      }

      terminal.write(output);
      writtenLengthRef.current = output.length;
      terminalRef.current = terminal;
      fitRef.current = fitAddon;

      const fitAndReport = () => {
        fitAddon.fit();
        onResizeRef.current(terminal.cols, terminal.rows);
      };
      fitAndReport();

      if ("ResizeObserver" in window) {
        resizeObserver = new ResizeObserver(fitAndReport);
        resizeObserver.observe(host);
      }
    }

    void openTerminal();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      terminalRef.current?.dispose();
      terminalRef.current = null;
      fitRef.current = null;
      writtenLengthRef.current = 0;
    };
  }, [session?.id]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    if (output.length < writtenLengthRef.current) {
      terminal.clear();
      terminal.write(output);
      writtenLengthRef.current = output.length;
      return;
    }

    const nextChunk = output.slice(writtenLengthRef.current);
    if (nextChunk) {
      terminal.write(nextChunk);
      writtenLengthRef.current = output.length;
    }
  }, [output]);

  if (!session) {
    return (
      <div className="empty-output" aria-label="Terminal output">
        <Monitor size={28} aria-hidden="true" />
        <h2>No active session</h2>
      </div>
    );
  }

  return (
    <div className="terminal-frame" aria-label="Terminal output">
      <div className="xterm-host" ref={hostRef} />
      <pre className="terminal-accessible" aria-label="Terminal output text">
        {output}
      </pre>
    </div>
  );
}
