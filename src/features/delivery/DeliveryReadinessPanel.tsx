import type { GitDeliveryProvenanceHistoryEntry, GitDeliveryReadinessInfo } from "../../types/domain";

interface Props {
  repositoryPath: string | null;
  readiness: GitDeliveryReadinessInfo | null;
  provenanceHistory: GitDeliveryProvenanceHistoryEntry[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function DeliveryReadinessPanel({
  repositoryPath, readiness, provenanceHistory, loading, error, onRefresh,
}: Props) {
  const ready = readiness?.worktreeClean && readiness.headProvenance.present;
  return <section className="task-dispatch-panel delivery-readiness-panel"
    aria-labelledby="delivery-readiness-title">
    <div className="doctor-heading"><div><h3 id="delivery-readiness-title">Delivery readiness</h3>
      <span>{readiness ? readinessLabel(readiness) : repositoryPath ? "Not checked yet" : "No repository"}</span></div>
      <button type="button" onClick={onRefresh} disabled={loading || !repositoryPath}>Refresh</button></div>
    {error ? <p className="error-message" role="alert">{error}</p> : null}
    {!repositoryPath ? <p>Select a repository to inspect Git readiness.</p> : null}
    {repositoryPath && loading && !readiness ? <p>Loading delivery readiness…</p> : null}
    {readiness ? <>
      <div className="delivery-readiness-summary" data-ready={ready}>
        <strong>{ready ? "Ready for delivery review" : "Not ready yet"}</strong>
        <span>{readiness.branch ?? "detached HEAD"} · {readiness.headSha ?? "unknown HEAD"}</span>
        {readiness.headSubject ? <small>{readiness.headSubject}</small> : null}
      </div>
      <dl className="delivery-readiness-checks" aria-label="Delivery readiness checks">
        <div><dt>Worktree</dt><dd>{readiness.worktreeClean
          ? "Clean" : `${readiness.changedFileCount} changed file(s)`}</dd></div>
        <div><dt>HEAD provenance</dt><dd>{readiness.headProvenance.present
          ? `Present${readiness.headProvenance.planStepId ? ` · step ${readiness.headProvenance.planStepId}` : ""}`
          : `Missing ${readiness.headProvenance.refName}`}</dd></div>
        <div><dt>Action policy</dt><dd>Read-only inspection. No Git command here mutates files or refs.</dd></div>
      </dl>
      {!readiness.worktreeClean ? <details>
        <summary>Changed files</summary>
        <ol className="delivery-changed-files">{readiness.changedFiles.map((file) => <li
          key={`${file.status}:${file.path}`}><strong>{file.status}</strong><span>{file.path}</span></li>)}</ol>
        {readiness.changedFileCount > readiness.changedFiles.length
          ? <p>{readiness.changedFileCount - readiness.changedFiles.length} more changed file(s) hidden.</p>
          : null}
      </details> : null}
      {readiness.headProvenance.notePreview ? <details>
        <summary>HEAD provenance note preview</summary>
        <pre>{readiness.headProvenance.notePreview}</pre>
      </details> : null}
      <div className="delivery-provenance-history">
        <div><h4>Recent provenance</h4><span>{provenanceHistory.length} commit(s)</span></div>
        {provenanceHistory.length > 0 ? <ol>
          {provenanceHistory.map((entry) => <li key={entry.commitSha}
            data-provenance={entry.hasProvenance}>
            <div><strong>{entry.shortSha}</strong><span>{entry.subject || "No commit subject"}</span></div>
            <small>{entry.hasProvenance
              ? `step ${entry.planStepId ?? "unknown"}${entry.severity === null ? "" : ` · severity ${entry.severity}`}`
              : "No provenance note"}</small>
            {entry.rationale ? <p>{entry.rationale}</p> : null}
          </li>)}
        </ol> : <p>No recent commits found.</p>}
      </div>
    </> : null}
  </section>;
}

function readinessLabel(readiness: GitDeliveryReadinessInfo) {
  if (!readiness.worktreeClean) return `${readiness.changedFileCount} changed file(s)`;
  if (!readiness.headProvenance.present) return "Missing HEAD provenance";
  return "Clean · provenance present";
}
