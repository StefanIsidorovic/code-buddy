import { StateNotice } from "../../components/ui/StateNotice";
import { formatMarkdownCategory, guardrailKindClassName, guardrailKindLabel,
  markdownCategoryClassName } from "../../lib/presentation";
import type { ProjectInfo, ProjectInitializationFactInfo,
  ProjectInitializationGuardrailInfo, ProjectInitializationInfo,
  ProjectInitializationMarkdownFindingInfo } from "../../types/domain";
import { InitializationSummaryCard, type InitializationSummaryCardProps } from "./InitializationSummaryCard";

type FactPreviewGroup = { repositoryId: string; repositoryName: string;
  facts: ProjectInitializationFactInfo[]; totalFacts: number };
export type ProjectInitializationPanelProps = {
  factGroupsCount: number;
  factPreviews: FactPreviewGroup[];
  facts: ProjectInitializationFactInfo[];
  guardrails: ProjectInitializationGuardrailInfo[];
  initialization: ProjectInitializationInfo | null;
  loading: boolean;
  markdownFindings: ProjectInitializationMarkdownFindingInfo[];
  markdownPreviews: ProjectInitializationMarkdownFindingInfo[];
  project: ProjectInfo | null;
  repositoryCount: number;
  summaryProps: InitializationSummaryCardProps;
  onAnalyzeMarkdown: () => void;
  onCollectFacts: () => void;
  onInitialize: () => void;
  onOpenInterview: () => void;
  onViewFacts: () => void;
  onViewMarkdown: () => void;
};
const phases = ["Preflight", "Facts", "Markdown", "Interview", "Summary"];
function phaseItems(status: string | null) {
  const active = phases.findIndex((phase) => phase.toLowerCase() === status);
  return phases.map((label, index) => ({ id: label.toLowerCase(), label,
    index: String(index + 1).padStart(2, "0"),
    state: active < 0 ? "upcoming" : index < active ? "complete" : index === active ? "current" : "upcoming" }));
}
function statusLabel(status: string) {
  return status.split("_").map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(" ");
}

export function ProjectInitializationPanel(props: ProjectInitializationPanelProps) {
  const { factGroupsCount, factPreviews, facts, guardrails, initialization, loading,
    markdownFindings, markdownPreviews, project, repositoryCount, summaryProps,
    onAnalyzeMarkdown, onCollectFacts, onInitialize, onOpenInterview, onViewFacts, onViewMarkdown } = props;
  const progress = phaseItems(initialization?.status ?? null);
  const guardrailPreviews = guardrails.slice(0, 3);
  return <section className="initialize-lane" aria-labelledby="project-initialize-lane-title">
    <div className="section-heading"><p className="eyebrow">Project knowledge</p>
      <h2 id="project-initialize-lane-title">Project Initialization</h2>
      <p className="section-description">Turn repository evidence and working rules into reviewable agent context.</p></div>
    <div className="project-initialize-section">
      <div className="project-initialize-hero"><div className="project-initialize-copy">
        <span className="section-kicker">Evidence workflow</span>
        <h3 id="project-initialize-title">Build agent-ready context</h3>
        <p>Choose repository scope, collect evidence, add guardrails, and approve the result.</p></div>
        <span className="initialize-run-status">{initialization
          ? `${statusLabel(initialization.status)} · ${initialization.repositoryCount} ${initialization.repositoryCount === 1 ? "repository" : "repositories"}`
          : project ? "Ready to start" : "Select workspace"}</span>
        <button className="primary-action" type="button" onClick={onInitialize}
          disabled={!project || repositoryCount === 0 || loading}>Initialize Project</button></div>
      <ol className="initialize-progress-list" aria-label="Project initialization phases">
        {progress.map((phase) => <li data-state={phase.state} key={phase.id}>
          <span>{phase.index}</span><strong>{phase.label}</strong></li>)}</ol>
      {initialization ? <><section className="initialize-preflight-summary" data-state={progress[0]?.state}
        aria-labelledby="initialize-preflight-title"><span className="initialize-phase-index">01</span>
        <div><span>Phase 1</span><h4 id="initialize-preflight-title">Preflight scope</h4>
          <p>{initialization.repositoryCount} {initialization.repositoryCount === 1 ? "repository" : "repositories"} selected for this initialization run.</p></div>
        <strong>{progress[0]?.state === "complete" ? "complete" : "scope saved"}</strong></section>
        <div className="initialize-results">
          <section className="initialize-result-card" aria-labelledby="initialize-facts-title">
            <div className="initialize-card-topline"><span className="initialize-phase-index">02</span>
              <div><span>Phase 2</span><h4 id="initialize-facts-title">Facts</h4></div>
              <strong data-state={facts.length ? "success" : "pending"}>{facts.length
                ? `${facts.length} collected` : "not collected"}</strong></div>
            <div className="initialize-card-actions"><button className="primary-action" type="button"
              onClick={onCollectFacts} disabled={loading}>Collect Facts</button>
              <button type="button" onClick={onViewFacts} disabled={!facts.length}>View Facts</button></div>
            {factPreviews.length ? <><div className="initialize-metric-grid" aria-label="Facts summary">
              <div><span>Repositories</span><strong>{factGroupsCount}</strong></div>
              <div><span>Facts</span><strong>{facts.length}</strong></div></div>
              <ul className="fact-preview-list" aria-label="Project initialization facts">
                {factPreviews.map((group) => <li key={group.repositoryId}>
                  <div className="fact-repository-heading"><strong>{group.repositoryName}</strong>
                    <small>{group.facts.length}/{group.totalFacts} shown</small></div>
                  <div className="fact-preview-grid">{group.facts.map((fact) => <div key={fact.id}>
                    <span>{fact.label}: {fact.value}</span><small>{fact.source}</small></div>)}</div>
                </li>)}</ul></> : <StateNotice kind="prerequisite" title="Facts are ready to collect"
              description="Run deterministic repository inspection to populate this phase." />}
          </section>
          <section className="initialize-result-card" aria-labelledby="initialize-markdown-title">
            <div className="initialize-card-topline"><span className="initialize-phase-index">03</span>
              <div><span>Phase 3</span><h4 id="initialize-markdown-title">Markdown</h4></div>
              <strong data-state={markdownFindings.length ? "success" : "pending"}>{markdownFindings.length
                ? `${markdownFindings.length} findings` : "not analyzed"}</strong></div>
            <div className="initialize-card-actions"><button className="primary-action" type="button"
              onClick={onAnalyzeMarkdown} disabled={loading}>Analyze Markdown</button>
              <button type="button" onClick={onViewMarkdown} disabled={!markdownFindings.length}>View Findings</button></div>
            {markdownPreviews.length ? <ul className="markdown-preview-list"
              aria-label="Project initialization markdown findings">{markdownPreviews.map((finding) => <li key={finding.id}>
                <div className="markdown-finding-heading"><span className={markdownCategoryClassName(finding.category)}>
                  {formatMarkdownCategory(finding.category)}</span><strong>{finding.title}</strong></div>
                <div className="markdown-finding-meta"><span>{finding.repositoryName}</span>
                  <small>{finding.filePath} · {finding.source}</small></div></li>)}</ul>
              : <StateNotice kind="prerequisite" title="Markdown is ready to analyze"
                description="Scan repository documentation to surface sourced project findings." />}
          </section>
          <section className="initialize-result-card" aria-labelledby="initialize-interview-title">
            <div className="initialize-card-topline"><span className="initialize-phase-index">04</span>
              <div><span>Phase 4</span><h4 id="initialize-interview-title">Interview</h4></div>
              <strong data-state={guardrails.length ? "success" : "pending"}>{guardrails.length
                ? `${guardrails.length} guardrails` : "not started"}</strong></div>
            <div className="initialize-card-actions initialize-card-actions-single">
              <button className="primary-action" type="button" onClick={onOpenInterview}
                disabled={loading}>Open Interview</button></div>
            {guardrailPreviews.length ? <ul className="guardrail-preview-list"
              aria-label="Project initialization guardrails">{guardrailPreviews.map((guardrail) => <li key={guardrail.id}>
                <div className="guardrail-heading"><span className={guardrailKindClassName(guardrail.kind)}>
                  {guardrailKindLabel(guardrail.kind)}</span><strong>{guardrail.repositoryName ?? "Project-wide"}</strong></div>
                {guardrail.pathPattern ? <code>{guardrail.pathPattern}</code> : null}<p>{guardrail.content}</p></li>)}</ul>
              : <StateNotice kind="prerequisite" title="No guardrails captured"
                description="Add fragile areas, do-not-touch paths, and review rules in the Interview." />}
          </section>
          <InitializationSummaryCard {...summaryProps} />
        </div></> : <StateNotice kind="prerequisite"
          title={!project ? "Choose a workspace to begin" : repositoryCount === 0
            ? "Add a repository before initialization" : "Ready to initialize project knowledge"}
          description={!project ? "Select or create a workspace from the navigation before starting this workflow."
            : repositoryCount === 0 ? "Open repository management and add at least one repository to define the evidence scope."
              : "Start Initialize to choose repository scope and create the Preflight record."} />}
    </div>
  </section>;
}
