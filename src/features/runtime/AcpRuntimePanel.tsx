import { ChevronIcon } from "../../components/ui/icons";
import type { AcpPermissionRequest, AcpPromptResult, AcpSessionInfo, TaskInfo } from "../../types/domain";

export type AcpRuntimePanelProps = {
  activeTask: TaskInfo | null; busy: boolean; canPreviewContext: boolean;
  canStartSelectedCandidate: boolean; canUseSession: boolean; expanded: boolean;
  prompt: string; promptBusy: boolean; promptResult: AcpPromptResult | null;
  permissions: AcpPermissionRequest[];
  session: AcpSessionInfo | null; showWaiting: boolean; statusLabel: string;
  onChangeModel: (modelId: string) => void; onChangePrompt: (prompt: string) => void;
  onDrain: () => void; onPreviewContext: () => void; onSendPrompt: () => void;
  onStartSelected: () => void; onStop: () => void;
  onRespondPermission: (permissionId: string, optionId: string) => void;
  onToggleExpanded: () => void;
};

export function AcpRuntimePanel(props: AcpRuntimePanelProps) {
  const { activeTask, busy, canPreviewContext, canStartSelectedCandidate, canUseSession,
    expanded, prompt, promptBusy, promptResult, permissions, session, showWaiting, statusLabel,
    onChangeModel, onChangePrompt, onDrain, onPreviewContext, onSendPrompt,
    onStartSelected, onStop, onRespondPermission, onToggleExpanded } = props;
  const codingModel = session?.codingModel;
  const currentModel = codingModel?.options.find(
    (option) => option.value === codingModel.currentValue,
  );
  const selectableModels = codingModel?.options.filter((option) =>
    option.value === codingModel.currentValue || option.available === true) ?? [];
  const canChangeModel = selectableModels.some((option) =>
    option.value !== codingModel?.currentValue && option.available === true);

  return (
    <section className="runtime-panel acp-runtime-panel" data-expanded={expanded} aria-labelledby="acp-title">
      <div className="doctor-heading acp-panel-heading">
        <div><h3 id="acp-title">ACP Controls</h3><span>{statusLabel}</span></div>
        <button aria-controls="acp-controls-content" aria-expanded={expanded}
          aria-label={expanded ? "Collapse ACP controls" : "Expand ACP controls"}
          className="acp-collapse-toggle" type="button" onClick={onToggleExpanded}
          title={expanded ? "Collapse controls" : "Expand controls"}>
          <ChevronIcon expanded={expanded} />
        </button>
      </div>

      <div className="acp-session-toolbar" data-active={canUseSession}>
        {!canUseSession ? (
          <div className="acp-start-actions" aria-label="ACP session start actions">
            <button className="primary-action" type="button" onClick={onStartSelected}
              disabled={busy || !canStartSelectedCandidate}>Start Selected ACP</button>
          </div>
        ) : (
          <p className="acp-session-status"><span aria-hidden="true" />Active session · {statusLabel}</p>
        )}
        {session ? (
          <div className="acp-session-utilities" aria-label="ACP active session actions">
            <button type="button" onClick={onDrain}>Drain ACP</button>
            <button className="danger-button" type="button" onClick={onStop}>Stop ACP</button>
          </div>
        ) : null}
      </div>

      <div className="acp-composer">
        <label className="prompt-field"><span>Prompt</span>
          <textarea aria-label="ACP prompt" onChange={(event) => onChangePrompt(event.target.value)}
            rows={3} value={prompt} />
        </label>
        <div className="acp-composer-actions" aria-label="ACP prompt actions">
          <button type="button" className="context-preview-button" onClick={onPreviewContext}
            disabled={!canPreviewContext}>Preview Context</button>
          <button className="primary-action" type="button" onClick={onSendPrompt}
            disabled={busy || promptBusy || !canUseSession}>Send ACP</button>
        </div>
      </div>

      {permissions.map((permission) => <section className="acp-permission-card" key={permission.id}
        aria-labelledby={`permission-${permission.id}`}><div><strong id={`permission-${permission.id}`}>
          Agent needs permission</strong><span>{permission.title}</span></div>
        <div>{permission.options.map((option) => <button type="button" key={option.optionId}
          data-kind={option.kind} onClick={() => onRespondPermission(permission.id, option.optionId)}>
          {option.name}</button>)}</div></section>)}

      <div className="acp-controls-content" hidden={!expanded} id="acp-controls-content">
        <div className="acp-coding-model">
          <label><span>Coding model</span>
            {codingModel && canChangeModel ? (
              <select aria-label="Coding model" value={codingModel.currentValue}
                onChange={(event) => onChangeModel(event.target.value)}
                disabled={busy || promptBusy || !canUseSession}>
                {selectableModels.map((option) => (
                  <option key={option.value} value={option.value}>{option.name}</option>
                ))}
              </select>
            ) : codingModel ? (
              <span className="acp-model-unavailable">{currentModel?.name
                ?? codingModel.currentValue}</span>
            ) : (
              <span className="acp-model-unavailable">
                {session ? "This agent does not advertise model selection."
                  : "Start an ACP session to load its available models."}
              </span>
            )}
          </label>
          {codingModel ? <small>{canChangeModel
            ? currentModel?.description ?? "Model used by this coding session."
            : currentModel?.unavailableReason
              ?? "The agent did not confirm any alternative coding models as compatible with this runtime."
          }</small> : null}
        </div>

        {activeTask ? (
          <section className="active-task-card" aria-labelledby="active-task-title">
            <div className="active-task-heading">
              <div><p className="eyebrow">Active Task</p><h4 id="active-task-title">Task assessment</h4></div>
              <span className="task-complexity-badge" data-profile={activeTask.complexityProfile}>
                {activeTask.complexityProfile}
              </span>
            </div>
            <dl className="active-task-meta">
              <div><dt>Phase</dt><dd>{activeTask.currentPhase}</dd></div>
              <div><dt>Assessment</dt><dd>{activeTask.complexitySource}</dd></div>
              <div><dt>Confidence</dt><dd>{activeTask.complexityConfidence === null
                ? "User selected" : `${activeTask.complexityConfidence}%`}</dd></div>
              <div><dt>Version</dt><dd>{activeTask.complexityAssessmentVersion}</dd></div>
            </dl>
            <div className="active-task-reasons"><strong>Why this profile</strong>
              <ul>{activeTask.complexityReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
            </div>
            {activeTask.initialComplexityProfile !== activeTask.complexityProfile ? (
              <p className="active-task-initial">Initially assessed as <strong>
                {activeTask.initialComplexityProfile}</strong>.</p>
            ) : null}
          </section>
        ) : null}
        {promptResult ? <p className="acp-result">Stop reason: {promptResult.stopReason}</p> : null}
        {showWaiting ? <p className="acp-result acp-waiting-status" role="status">
          Waiting for agent response...
        </p> : null}
      </div>
    </section>
  );
}
