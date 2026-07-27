import { useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "../../components/ui/icons";
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
  const [open, setOpen] = useState(false);
  const { busy, candidates, error, loading, selectedCandidateId, sessionLocked,
    onRefresh, onSelect } = props;
  const selected = candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null;
  return <>
    <button className="sidebar-modal-trigger sidebar-agent" type="button"
      aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <span><strong>ACP Agents</strong><small>Manage available coding agents</small></span>
      <span><strong>{selected?.name ?? "None selected"}</strong><b aria-hidden="true">›</b></span>
    </button>
    {open ? createPortal(<div className="modal-backdrop sidebar-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setOpen(false);
    }}>
      <section aria-labelledby="sidebar-acp-registry-title" aria-modal="true"
        className="knowledge-modal sidebar-management-modal acp-registry-modal" role="dialog">
        <div className="modal-heading">
          <div><p className="eyebrow">Agent environment</p>
            <h2 id="sidebar-acp-registry-title">ACP Agents</h2>
            <span>Select the ACP agent used for new sessions.</span></div>
          <button aria-label="Close ACP Agents" className="icon-button"
            type="button" onClick={() => setOpen(false)}><CloseIcon /></button>
        </div>
        <div className="sidebar-modal-toolbar">
          <strong>{candidates.length} available</strong>
          <button type="button" onClick={onRefresh} disabled={loading}>Refresh</button>
        </div>
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      <ul className="registry-list" aria-label="ACP registry candidates">
        {candidates.map((candidate) => <li className="registry-item"
          data-selected={candidate.id === selected?.id} data-status={candidate.status} key={candidate.id}>
          <div><strong>{candidate.name}</strong><span>{candidate.description}</span></div>
          <div><span className="doctor-status">{acpCandidateStatusLabel(candidate.status)}</span>
            <span>{candidate.version} · {candidate.distribution}</span>
            <span className="registry-command-tooltip" tabIndex={0}
              aria-label={`Show ${candidate.name} launch command`}>
              Command <span aria-hidden="true">ⓘ</span>
              <span className="registry-command-popover" role="tooltip">
                <strong>Launch command</strong><code>{formatCommand(candidate.command)}</code>
                <small>{candidate.installHint}</small>
              </span>
            </span>
            <button aria-label={`Select ${candidate.name} ACP candidate`}
              aria-pressed={candidate.id === selected?.id} disabled={busy || sessionLocked}
              type="button" onClick={() => onSelect(candidate.id)}>
              {candidate.id === selected?.id ? "Selected" : "Select"}</button>
          </div>
        </li>)}
      </ul>
      {selected ? <dl className="selected-candidate" aria-label="Selected ACP candidate">
        <div><dt>Selected ACP</dt><dd>{selected.name}</dd></div>
      </dl> : null}
      </section>
    </div>, document.body) : null}
  </>;
}
