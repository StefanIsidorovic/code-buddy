import { StateNotice } from "../../components/ui/StateNotice";
import { CloseIcon } from "../../components/ui/icons";
import { formatMarkdownCategory, markdownCategoryClassName } from "../../lib/presentation";
import type {
  InitializeDetailsView, KnowledgeUnitInfo, ProjectInitializationFactInfo,
  ProjectInitializationMarkdownFindingInfo, ProjectInitializationSummaryInfo,
  ProjectInitializationSummaryClaimInfo,
} from "../../types/domain";

export type InitializationFactGroup = {
  repositoryId: string;
  repositoryName: string;
  facts: ProjectInitializationFactInfo[];
};

export type InitializationDetailsDialogProps = {
  factGroups: InitializationFactGroup[];
  initializeLoading: boolean;
  knowledgeUnits: KnowledgeUnitInfo[];
  knowledgeUnitsError: string | null;
  knowledgeUnitsLoading: boolean;
  markdownFindings: ProjectInitializationMarkdownFindingInfo[];
  summary: ProjectInitializationSummaryInfo | null;
  regeneratingSection: string | null;
  view: InitializeDetailsView;
  onApproveSummary: () => void;
  onReviewSummaryClaim: (claimId: string, status: "accepted" | "rejected" | "deferred",
    content: string, rejectionReason: string | null) => void;
  onPrepareSummaryAutopilot: () => void;
  onRegenerateSummarySection: (section: string) => void;
  onClose: () => void;
};

function SummaryClaimReview({ claim, loading, onReview }: {
  claim: ProjectInitializationSummaryClaimInfo; loading: boolean;
  onReview: InitializationDetailsDialogProps["onReviewSummaryClaim"];
}) {
  const [content, setContent] = useState(claim.content);
  const [reason, setReason] = useState(claim.rejectionReason ?? "");
  const locked = loading || claim.status === "accepted" || claim.status === "rejected";
  return <li className={`summary-claim-review ${claim.status}`}>
    <div className="summary-claim-heading"><strong>{claim.section.replace(/_/g, " ")}</strong>
      <span>{claim.status}</span></div>
    <label>Claim<textarea value={content} disabled={locked}
      onChange={(event) => setContent(event.target.value)} /></label>
    {claim.status !== "accepted" ? <label>Rejection reason
      <input value={reason} disabled={loading || claim.status === "rejected"}
        onChange={(event) => setReason(event.target.value)} /></label> : null}
    {claim.status === "pending" || claim.status === "deferred" ? <div className="summary-claim-actions">
      <button type="button" disabled={loading || !content.trim()}
        onClick={() => onReview(claim.id, "accepted", content, null)}>Accept</button>
      <button type="button" disabled={loading || !content.trim()}
        onClick={() => onReview(claim.id, "deferred", content, null)}>Defer</button>
      <button type="button" disabled={loading || !content.trim() || !reason.trim()}
        onClick={() => onReview(claim.id, "rejected", content, reason)}>Reject</button>
    </div> : null}
    {claim.rejectionReason ? <small>Reason: {claim.rejectionReason}</small> : null}
  </li>;
}

function FactsDetails({ groups }: { groups: InitializationFactGroup[] }) {
  if (groups.length === 0) return <StateNotice kind="prerequisite"
    title="Facts have not been collected yet"
    description="Return to Project Initialization and run Collect Facts first." />;
  return <ul className="fact-list details-fact-list" aria-label="Project initialization fact details">
    {groups.map((group) => <li key={group.repositoryId}>
      <div className="fact-repository-heading"><strong>{group.repositoryName}</strong>
        <small>{group.facts.length} facts</small></div>
      <div className="fact-grid">{group.facts.map((fact) => <div key={fact.id}>
        <span>{fact.label}: {fact.value}</span><small>{fact.source}</small>
      </div>)}</div>
    </li>)}
  </ul>;
}

function MarkdownDetails({ findings }: { findings: ProjectInitializationMarkdownFindingInfo[] }) {
  if (findings.length === 0) return <StateNotice kind="prerequisite"
    title="Markdown has not been analyzed yet"
    description="Return to Project Initialization and run Analyze Markdown first." />;
  return <ul className="markdown-finding-list details-markdown-list"
    aria-label="Project initialization markdown finding details">
    {findings.map((finding) => <li key={finding.id}>
      <div className="markdown-finding-heading">
        <span className={markdownCategoryClassName(finding.category)}>
          {formatMarkdownCategory(finding.category)}</span><strong>{finding.title}</strong>
      </div>
      <p>{finding.excerpt}</p>
      <div className="markdown-finding-meta"><span>{finding.repositoryName}</span>
        <small>{finding.filePath} · {finding.source}</small></div>
    </li>)}
  </ul>;
}

function PublishedUnits(props: Pick<InitializationDetailsDialogProps,
  "knowledgeUnits" | "knowledgeUnitsError" | "knowledgeUnitsLoading" | "summary">) {
  const { knowledgeUnits, knowledgeUnitsError, knowledgeUnitsLoading, summary } = props;
  return <section className="knowledge-unit-preview" aria-label="Published knowledge units">
    <div className="knowledge-unit-preview-heading"><div><span>Approved knowledge</span>
      <h3>Published units</h3></div><strong>{knowledgeUnits.length}</strong></div>
    {summary?.status !== "approved" ? <StateNotice kind="prerequisite" title="Approval required"
      description="Knowledge Units are published only after this Summary is approved." />
      : knowledgeUnitsLoading ? <StateNotice kind="loading" title="Loading published units…"
        description="Retrieving approved Knowledge Units and their source provenance." />
      : knowledgeUnitsError ? <StateNotice kind="error" title="Published units could not be loaded"
        description={knowledgeUnitsError} />
      : knowledgeUnits.length === 0 ? <StateNotice kind="empty"
        title="No Knowledge Units were published"
        description="The approved Summary did not produce any active or reviewable units." />
      : <ul className="knowledge-unit-list">{knowledgeUnits.map((unit) => <li key={unit.id}>
        <div className="knowledge-unit-meta"><span>{unit.kind.replace(/_/g, " ")}</span>
          <span>{unit.topic.replace(/_/g, " ")}</span>
          <span className={`knowledge-unit-status ${unit.status}`}>
            {unit.status.replace(/_/g, " ")}</span><span>{unit.confidence}% confidence</span></div>
        <p>{unit.content}</p><div className="knowledge-unit-sources"><span>Sources</span>
          {unit.sources.length > 0 ? unit.sources.map((source) =>
            <code key={`${unit.id}-${source.sourceKey}`}>{source.sourceKey}
              {source.path ? ` · ${source.path}` : ""}</code>)
            : <em>Needs confirmation; no evidence source.</em>}</div>
      </li>)}</ul>}
  </section>;
}

function SummaryDetails(props: InitializationDetailsDialogProps) {
  const { summary, initializeLoading, regeneratingSection, onApproveSummary,
    onReviewSummaryClaim, onPrepareSummaryAutopilot, onRegenerateSummarySection, onClose } = props;
  if (!summary) return <StateNotice kind="prerequisite" title="No summary available for review"
    description="Generate a Summary draft before opening the detailed review." />;
  const sections = [
    ["project_purpose", "Purpose", summary.projectPurpose],
    ["repository_map", "Repositories", summary.repositoryMap],
    ["repository_roles", "Repository Roles", summary.repositoryRoles],
    ["build_test_matrix", "Build/Test", summary.buildTestMatrix],
    ["fragile_areas", "Fragile Areas", summary.fragileAreas],
    ["do_not_touch_rules", "Do Not Touch", summary.doNotTouchRules],
    ["agent_working_rules", "Agent Rules", summary.agentWorkingRules],
    ["open_questions", "Open Questions", summary.openQuestions],
  ];
  const claims = summary.claims ?? [];
  const pendingCount = claims.filter((claim) => claim.status === "pending").length;
  const acceptedCount = claims.filter((claim) =>
    claim.status === "accepted" && claim.section !== "open_questions").length;
  return <>
    <div className="summary-details" aria-label="Project initialization summary">
      <div className="initialize-metric-grid" aria-label="Summary source counts">
        <div><span>Facts</span><strong>{summary.factCount}</strong></div>
        <div><span>Markdown</span><strong>{summary.markdownFindingCount}</strong></div>
        <div><span>Rules</span><strong>{summary.guardrailCount}</strong></div>
      </div>
      <dl className="summary-provenance-grid" aria-label="Summary generation provenance">
        <div><dt>Requested model</dt><dd>{summary.requestedModelProviderId && summary.requestedModelId
          ? `${summary.requestedModelProviderId} / ${summary.requestedModelId}`
          : "Legacy deterministic draft"}</dd></div>
        <div><dt>Tier</dt><dd>{summary.requestedModelTier ?? "unversioned"}</dd></div>
        <div><dt>Generator</dt><dd>{summary.generationEngine}</dd></div>
        <div><dt>Schema</dt><dd>knowledge {summary.knowledgeSchemaVersion} · catalog{" "}
          {summary.modelCatalogSchemaVersion ?? "legacy"}</dd></div>
      </dl>
      {summary.status === "approved" ? <StateNotice kind="success" title="Summary approved"
        description="This is the read-only approved snapshot. Published Knowledge Units are shown below." /> : null}
      <dl className="summary-section-list details-summary-list">{sections.map(([section, label, value]) =>
        <div key={section}><dt>{label}</dt><dd>{value}</dd>
          {summary.status !== "approved" ? <button type="button" disabled={initializeLoading}
            onClick={() => onRegenerateSummarySection(section)}>
            {regeneratingSection === section ? "Regenerating…" : `Regenerate ${label}`}
          </button> : null}</div>)}</dl>
      {summary.status !== "approved" ? <section className="summary-claim-review-list"
        aria-label="Summary claim review">
        <div className="knowledge-unit-preview-heading"><div><span>Approval preview</span>
          <h3>{acceptedCount} claim(s) will be published</h3></div>
          <strong>{pendingCount} pending</strong></div>
        {pendingCount > 0 ? <div className="state-notice prerequisite">
          <strong>Project Autopilot</strong>
          <p>Accepts pending generated knowledge claims and defers pending Open Questions.
            Existing decisions stay unchanged. It does not publish anything; you will still
            confirm Approve Summary once.</p>
          <button type="button" disabled={initializeLoading}
            onClick={onPrepareSummaryAutopilot}>
            {initializeLoading ? "Preparing…" : "Prepare review with Autopilot"}
          </button>
        </div> : <StateNotice kind="success" title="Ready for final approval"
          description="All claims have decisions. Review the preview, then approve once to publish." />}
        <ul>{claims.map((claim) => <SummaryClaimReview key={claim.id}
          claim={claim} loading={initializeLoading} onReview={onReviewSummaryClaim} />)}</ul>
      </section> : null}
      <PublishedUnits {...props} />
    </div>
    <div className="modal-actions"><button type="button" onClick={onClose}>Close</button>
      <button type="button" onClick={onApproveSummary}
        disabled={initializeLoading || summary.status === "approved" ||
          pendingCount > 0 || acceptedCount === 0}>Approve Summary</button></div>
  </>;
}

export function InitializationDetailsDialog(props: InitializationDetailsDialogProps) {
  const { view, onClose } = props;
  const title = view === "facts" ? "Facts Detail"
    : view === "summary" ? "Summary Review" : "Markdown Findings";
  return <div className="modal-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}><section aria-labelledby="initialize-details-dialog-title" aria-modal="true"
    className="knowledge-modal initialize-details-modal" role="dialog">
    <div className="modal-heading"><div><p className="eyebrow">Initialize</p>
      <h2 id="initialize-details-dialog-title">{title}</h2></div>
      <button aria-label="Close initialization details" className="icon-button"
        type="button" onClick={onClose}><CloseIcon /></button></div>
    {view === "facts" ? <FactsDetails groups={props.factGroups} />
      : view === "markdown" ? <MarkdownDetails findings={props.markdownFindings} />
      : <SummaryDetails {...props} />}
  </section></div>;
}
import { useState } from "react";
