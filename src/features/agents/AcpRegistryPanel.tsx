import { acpCandidateStatusLabel, formatCommand } from "../../lib/presentation";
import type { AcpRegistryCandidate } from "../../types/domain";

export type AcpRegistryPanelProps = {
  busy: boolean;
  candidates: AcpRegistryCandidate[];
  error: string | null;
  loading: boolean;
  selectedCandidateId: string | null;
  sessionLocked: boolean;
  onRefresh: () => void;
  onSelect: (candidateId: string) => void;
};

export function AcpRegistryPanel(props: AcpRegistryPanelProps) {
  const { busy, candidates, error, loading, selectedCandidateId, sessionLocked,
    onRefresh, onSelect } = props;
  const selected = candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null;
  return <details className="agent-accordion sidebar-agent">
    <summary><span>ACP Agents</span><strong>{selected?.name ?? "none selected"}</strong></summary>
    <div className="accordion-body">
      <div className="doctor-heading"><h3 id="sidebar-acp-registry-title">ACP Registry</h3>
        <button type="button" onClick={onRefresh} disabled={loading}>Refresh</button></div>
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      <ul className="registry-list" aria-label="ACP registry candidates">
        {candidates.map((candidate) => <li className="registry-item"
          data-selected={candidate.id === selected?.id} data-status={candidate.status} key={candidate.id}>
          <div><strong>{candidate.name}</strong><span>{candidate.description}</span></div>
          <div><span className="doctor-status">{acpCandidateStatusLabel(candidate.status)}</span>
            <span>{candidate.version} · {candidate.distribution}</span>
            <code>{formatCommand(candidate.command)}</code><span>{candidate.installHint}</span>
            <button aria-label={`Select ${candidate.name} ACP candidate`}
              aria-pressed={candidate.id === selected?.id} disabled={busy || sessionLocked}
              type="button" onClick={() => onSelect(candidate.id)}>
              {candidate.id === selected?.id ? "Selected" : "Select"}</button>
          </div>
        </li>)}
      </ul>
      {selected ? <dl className="selected-candidate" aria-label="Selected ACP candidate">
        <div><dt>Selected ACP</dt><dd>{selected.name}</dd></div>
        <div><dt>Command</dt><dd><code>{formatCommand(selected.command)}</code></dd></div>
      </dl> : null}
    </div>
  </details>;
}
