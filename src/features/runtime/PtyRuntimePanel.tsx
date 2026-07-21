export interface PtyRuntimePanelProps {
  busy: boolean;
  canStartCodex: boolean;
  hasSession: boolean;
  sessionUsable: boolean;
  statusLabel: string;
  terminalSize: { cols: number; rows: number };
  onDrain: () => void;
  onResize: () => void;
  onStartCodex: () => void;
  onStartFake: () => void;
  onStop: (force: boolean) => void;
  onUseAcp: () => void;
}

export function PtyRuntimePanel({
  busy,
  canStartCodex,
  hasSession,
  sessionUsable,
  statusLabel,
  terminalSize,
  onDrain,
  onResize,
  onStartCodex,
  onStartFake,
  onStop,
  onUseAcp,
}: PtyRuntimePanelProps) {
  return (
    <section className="runtime-panel" aria-labelledby="pty-controls-title">
      <div className="doctor-heading">
        <h3 id="pty-controls-title">PTY Controls</h3>
        <span>{statusLabel}</span>
      </div>

      <div className="button-row">
        <button type="button" onClick={onUseAcp} disabled={sessionUsable}>Use ACP</button>
        <button type="button" onClick={onStartFake} disabled={busy || sessionUsable}>Start Fake</button>
        <button type="button" onClick={onStartCodex} disabled={busy || sessionUsable || !canStartCodex}>
          Start Codex
        </button>
        <button type="button" onClick={onDrain} disabled={busy || !hasSession}>Drain</button>
        <button type="button" onClick={onResize} disabled={busy || !sessionUsable}>Resize</button>
        <button type="button" onClick={() => onStop(false)} disabled={busy || !hasSession}>Stop</button>
        <button type="button" onClick={() => onStop(true)} disabled={busy || !hasSession}>Kill</button>
      </div>

      <dl className="terminal-meta" aria-label="Terminal state">
        <div>
          <dt>Terminal</dt>
          <dd>{terminalSize.cols}x{terminalSize.rows}</dd>
        </div>
      </dl>
    </section>
  );
}
