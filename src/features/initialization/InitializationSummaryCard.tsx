import { StateNotice } from "../../components/ui/StateNotice";
import { formatModelTier, modelCapabilityBadges } from "../../lib/presentation";
import type { ModelCatalogInfo, ModelProfileInfo, ModelTier,
  ProjectInitializationSummaryInfo } from "../../types/domain";

const modelTiers: ModelTier[] = ["fast", "mid", "high", "max"];
export type InitializationSummaryCardProps = {
  catalog: ModelCatalogInfo | null;
  loading: boolean;
  profileId: string;
  selectedProfile: ModelProfileInfo | null;
  summary: ProjectInitializationSummaryInfo | null;
  tier: ModelTier;
  onChangeProfile: (profileId: string) => void;
  onChangeTier: (tier: ModelTier) => void;
  onGenerate: () => void;
  onView: () => void;
};

export function InitializationSummaryCard(props: InitializationSummaryCardProps) {
  const { catalog, loading, profileId, selectedProfile, summary, tier, onChangeProfile,
    onChangeTier, onGenerate, onView } = props;
  const profiles = (catalog?.profiles ?? []).filter((profile) => profile.tier === tier);
  const provider = catalog?.providers.find((item) => item.id === selectedProfile?.providerId) ?? null;
  return <section className="initialize-result-card" aria-labelledby="initialize-summary-title">
    <div className="initialize-card-topline"><span className="initialize-phase-index">05</span>
      <div><span>Phase 5</span><h4 id="initialize-summary-title">Summary</h4></div>
      <strong data-state={summary ? "success" : "pending"}>{summary?.status ?? "not generated"}</strong>
    </div>
    <div className="synthesis-model-controls">
      <div className="model-tier-control" role="group" aria-label="Synthesis tier">
        {modelTiers.map((item) => <button key={item} type="button" aria-pressed={tier === item}
          onClick={() => onChangeTier(item)}>{formatModelTier(item)}</button>)}
      </div>
      <label className="synthesis-model-select"><span>Synthesis model</span>
        <select aria-label="Synthesis model" value={profileId}
          onChange={(event) => onChangeProfile(event.target.value)} disabled={!catalog || profiles.length === 0}>
          {profiles.length === 0 ? <option value="">No profile for this tier</option> : null}
          {profiles.map((profile) => <option key={profile.id} value={profile.id}
            disabled={profile.status !== "selectable"}>{profile.displayName}
            {profile.status === "unavailable" && profile.unavailableReason
              ? ` — ${profile.unavailableReason}` : ""}</option>)}
        </select>
      </label>
      {selectedProfile ? <><div className="model-capability-list" aria-label="Synthesis model capabilities">
        <span className="model-provider-badge">{provider?.displayName ?? selectedProfile.providerId}</span>
        {modelCapabilityBadges(selectedProfile).map((capability) => <span key={capability.label}
          className={`model-capability model-capability-${capability.status}`}
          title={`${capability.label}: ${capability.status}`}>{capability.label}</span>)}
      </div>{selectedProfile.status === "unavailable" && selectedProfile.unavailableReason
        ? <p className="model-availability-note" role="status">{selectedProfile.unavailableReason}</p>
        : null}</> : null}
    </div>
    <div className="initialize-card-actions"><button className="primary-action summary-generate-action" type="button"
      onClick={onGenerate} disabled={loading || !selectedProfile || selectedProfile.status !== "selectable"}
      aria-busy={loading}>
      {loading ? <><span className="button-spinner" aria-hidden="true" />Generating Summary…</> : "Generate Summary"}
    </button><button type="button" onClick={onView} disabled={!summary}>View Summary</button></div>
    {summary ? <div className="summary-preview" aria-label="Project initialization summary preview">
      <div className="initialize-metric-grid" aria-label="Summary source counts">
        <div><span>Facts</span><strong>{summary.factCount}</strong></div>
        <div><span>Markdown</span><strong>{summary.markdownFindingCount}</strong></div>
        <div><span>Rules</span><strong>{summary.guardrailCount}</strong></div></div>
      <p className="summary-compact-note">{summary.status === "approved"
        ? "Approved profile is ready for agent context." : "Draft profile is ready for review."}</p>
      <p className="summary-model-provenance"><strong>{summary.requestedModelId ?? "Legacy deterministic draft"}</strong>
        <span>{summary.requestedModelTier ?? "unversioned"} · {summary.generationEngine}</span></p>
    </div> : <StateNotice kind="prerequisite" title="No summary draft"
      description="Generate a reviewable profile from Facts, Markdown, and Interview evidence." />}
  </section>;
}
