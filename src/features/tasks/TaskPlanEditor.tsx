import { useEffect, useState } from "react";
import type { TaskPhaseArtifactInfo, TaskPlanCritiqueInfo, TaskPlanDraft, TaskPlanEvaluationInfo,
  TaskPlanVersionInfo } from "../../types/domain";
import { TaskPlanCritiquePanel } from "./TaskPlanCritiquePanel";
import { TaskPlanEvaluationPanel } from "./TaskPlanEvaluationPanel";
import { parseTaskPlanDraft } from "./taskPlanDraft";

type RequirementDraft = { id: string; text: string; kind: string };
type StepDraft = { title: string; description: string; kind: string; complexity: number;
  criteria: string; paths: string; satisfies: string };
interface Props {
  sourceArtifact: TaskPhaseArtifactInfo | null;
  versions: TaskPlanVersionInfo[];
  loading: boolean;
  error: string | null;
  evaluation: TaskPlanEvaluationInfo | null;
  critique: TaskPlanCritiqueInfo | null;
  canRunCritique: boolean;
  onCreate: (sourceArtifactId: string, draft: TaskPlanDraft) => void;
  onEvaluate: (planVersionId: string) => void;
  onRunCritique: () => void;
  onApplyRepairs: () => void;
  onApprove: (planVersionId: string) => void;
}

const requirement = (index: number): RequirementDraft =>
  ({ id: `REQ-${index + 1}`, text: "", kind: "functional" });
const step = (): StepDraft => ({ title: "", description: "", kind: "implementation",
  complexity: 2, criteria: "", paths: "", satisfies: "REQ-1" });
const lines = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);
const commaList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
const editRequirements = (draft: TaskPlanDraft): RequirementDraft[] =>
  draft.requirements.map(({ id, text, kind }) => ({ id, text, kind }));
const editSteps = (draft: TaskPlanDraft): StepDraft[] => draft.steps.map((item) => ({
  title: item.title, description: item.description, kind: item.kind, complexity: item.complexity,
  criteria: item.acceptanceCriteria.join("\n"), paths: item.expectedPaths.join(", "),
  satisfies: item.satisfies.join(", "),
}));

export function TaskPlanEditor({ sourceArtifact, versions, loading, error, evaluation, critique,
  canRunCritique, onCreate, onEvaluate, onRunCritique, onApplyRepairs, onApprove }: Props) {
  const [requirements, setRequirements] = useState<RequirementDraft[]>([requirement(0)]);
  const [steps, setSteps] = useState<StepDraft[]>([step()]);
  const [dirty, setDirty] = useState(false);
  const [generated, setGenerated] = useState(false);
  const approved = versions.find(({ status }) => status === "approved") ?? null;
  const latest = versions[versions.length - 1] ?? null;
  const evidenceDraft = sourceArtifact ? parseTaskPlanDraft(sourceArtifact.content) : null;
  const applyDraft = (draft: TaskPlanDraft, isGenerated: boolean) => {
    setRequirements(editRequirements(draft)); setSteps(editSteps(draft));
    setGenerated(isGenerated); setDirty(false);
  };
  useEffect(() => {
    if (!latest || latest.status === "approved") return;
    applyDraft(latest, false);
  }, [latest?.id, latest?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!evidenceDraft || latest || dirty) return;
    applyDraft(evidenceDraft, true);
  }, [sourceArtifact?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const valid = requirements.every((item) => item.id.trim() && item.text.trim())
    && steps.every((item) => item.title.trim() && item.description.trim() && item.criteria.trim()
      && (item.kind === "infrastructure" || item.satisfies.trim()));
  const updateRequirement = (index: number, patch: Partial<RequirementDraft>) =>
    { setDirty(true); setGenerated(false); setRequirements((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item)); };
  const updateStep = (index: number, patch: Partial<StepDraft>) =>
    { setDirty(true); setGenerated(false); setSteps((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item)); };

  if (approved) return <section className="task-plan-editor" aria-labelledby="structured-plan-title">
    <div><h4 id="structured-plan-title">Approved implementation plan</h4>
      <span>v{approved.version} · {approved.requirements.length} requirement(s) · {approved.steps.length} step(s)</span></div>
    <ol className="task-plan-approved-steps">{approved.steps.map((item) => <li key={item.id}>
      <strong>{item.orderIndex + 1}. {item.title}</strong>
      <span>complexity {item.complexity} · satisfies {item.satisfies.join(", ") || "infrastructure"}</span>
      <p>{item.description}</p>
    </li>)}</ol>
  </section>;

  return <section className="task-plan-editor" aria-labelledby="structured-plan-title">
    <div><h4 id="structured-plan-title">Structured implementation plan</h4>
      <span>{versions.length} draft version(s)</span></div>
    <p className="task-helper-card">Turn the saved planning evidence into requirements and ordered
      implementation steps. Saving creates an immutable version; approval locks the chosen version.</p>
    {generated ? <p className="state-notice success" role="status"><strong>Agent-generated draft</strong>
      <span>Review and edit it before saving a plan version.</span></p> : null}
    {evidenceDraft && !generated ? <button type="button"
      onClick={() => applyDraft(evidenceDraft, true)}>Restore from planning evidence</button> : null}
    {sourceArtifact && !evidenceDraft && !latest ? <p className="task-helper-card" role="note">
      This planning evidence has no valid structured draft. Fill the form manually or rerun the
      planning agent to generate one.</p> : null}
    {error ? <p className="error-message" role="alert">{error}</p> : null}
    <fieldset><legend>Requirements</legend>
      {requirements.map((item, index) => <div className="task-plan-row" key={index}>
        <input aria-label={`Requirement ${index + 1} ID`} value={item.id}
          onChange={(event) => updateRequirement(index, { id: event.target.value })} />
        <select aria-label={`Requirement ${index + 1} kind`} value={item.kind}
          onChange={(event) => updateRequirement(index, { kind: event.target.value })}>
          <option value="functional">Functional</option><option value="constraint">Constraint</option>
          <option value="non_functional">Non-functional</option><option value="out_of_scope">Out of scope</option>
        </select>
        <input aria-label={`Requirement ${index + 1} text`} value={item.text}
          placeholder="One testable assertion"
          onChange={(event) => updateRequirement(index, { text: event.target.value })} />
        {requirements.length > 1 ? <button type="button" onClick={() => {
          setDirty(true); setGenerated(false);
          setRequirements((current) => current.filter((_, itemIndex) => itemIndex !== index));
        }}>Remove</button> : null}
      </div>)}
      <button type="button" onClick={() => {
        setDirty(true); setGenerated(false);
        setRequirements((current) => [...current, requirement(current.length)]);
      }}>
        Add requirement</button>
    </fieldset>
    <fieldset><legend>Ordered steps</legend>
      {steps.map((item, index) => <div className="task-plan-step-draft" key={index}>
        <strong>Step {index + 1}</strong>
        <input aria-label={`Step ${index + 1} title`} value={item.title} placeholder="Verb-first title"
          onChange={(event) => updateStep(index, { title: event.target.value })} />
        <textarea aria-label={`Step ${index + 1} description`} rows={2} value={item.description}
          placeholder="What this step changes"
          onChange={(event) => updateStep(index, { description: event.target.value })} />
        <div><select aria-label={`Step ${index + 1} kind`} value={item.kind}
          onChange={(event) => updateStep(index, { kind: event.target.value })}>
          <option value="implementation">Implementation</option><option value="infrastructure">Infrastructure</option>
        </select>
        <label>Complexity <input type="number" min={1} max={5} value={item.complexity}
          onChange={(event) => updateStep(index, { complexity: Number(event.target.value) })} /></label></div>
        <textarea aria-label={`Step ${index + 1} acceptance criteria`} rows={2} value={item.criteria}
          placeholder="Acceptance criteria, one per line"
          onChange={(event) => updateStep(index, { criteria: event.target.value })} />
        <input aria-label={`Step ${index + 1} expected paths`} value={item.paths}
          placeholder="Expected paths, comma separated"
          onChange={(event) => updateStep(index, { paths: event.target.value })} />
        <input aria-label={`Step ${index + 1} requirements`} value={item.satisfies}
          placeholder="Requirement IDs, comma separated"
          onChange={(event) => updateStep(index, { satisfies: event.target.value })} />
        {steps.length > 1 ? <button type="button" onClick={() => {
          setDirty(true); setGenerated(false);
          setSteps((current) => current.filter((_, itemIndex) => itemIndex !== index));
        }}>Remove step</button> : null}
      </div>)}
      <button type="button" onClick={() => {
        setDirty(true); setGenerated(false); setSteps((current) => [...current, step()]);
      }}>Add step</button>
    </fieldset>
    <button type="button" disabled={loading || !sourceArtifact || !valid} onClick={() => {
      if (!sourceArtifact) return;
      onCreate(sourceArtifact.id, { requirements, steps: steps.map((item) => ({
        title: item.title, description: item.description, kind: item.kind, complexity: item.complexity,
        acceptanceCriteria: lines(item.criteria), expectedPaths: commaList(item.paths),
        satisfies: commaList(item.satisfies),
      })) });
    }}>Save new plan version</button>
    {!sourceArtifact ? <small className="task-helper-card">Save planning evidence before creating
      its structured plan.</small> : null}
    {latest ? <TaskPlanEvaluationPanel plan={latest} evaluation={evaluation} loading={loading}
      onEvaluate={onEvaluate} /> : null}
    {evaluation ? <TaskPlanCritiquePanel evaluation={evaluation} critique={critique}
      loading={loading} canRun={canRunCritique} onRun={onRunCritique}
      onApply={onApplyRepairs} /> : null}
    {latest ? <div className="task-plan-version">
      <span>Latest draft: v{latest.version} · {latest.requirements.length} requirement(s)
        · {latest.steps.length} step(s)</span>
      <button type="button" disabled={loading || !evaluation || evaluation.verdict === "blocked"}
        onClick={() => onApprove(latest.id)}>
        Approve plan v{latest.version}</button>
      {!evaluation ? <small>Run deterministic evaluation before approval.</small>
        : evaluation.verdict === "blocked"
          ? <small>Resolve blocking findings in a new plan version before approval.</small>
          : null}
    </div> : null}
  </section>;
}
