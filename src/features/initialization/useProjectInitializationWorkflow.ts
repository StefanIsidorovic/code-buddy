import { useEffect, useState } from "react";
import { errorText, uniqueIds } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type { InitializeDetailsView, InterviewScope, ModelProfileInfo, ProjectInfo,
  ProjectInitializationFactInfo, ProjectInitializationGuardrailInfo,
  ProjectInitializationGuardrailInput, ProjectInitializationGuardrailKind,
  ProjectInitializationInfo, ProjectInitializationMarkdownFindingInfo,
  ProjectInitializationSummaryInfo, ProjectRepositoryInfo } from "../../types/domain";

interface EvidenceActions {
  setInitialization: (value: ProjectInitializationInfo) => void;
  advanceStatus: (value: ProjectInitializationInfo, status: ProjectInitializationInfo["status"]) => void;
  setFacts: (id: string, value: ProjectInitializationFactInfo[]) => void;
  setMarkdown: (id: string, value: ProjectInitializationMarkdownFindingInfo[]) => void;
  setGuardrails: (id: string, value: ProjectInitializationGuardrailInfo[]) => void;
  setSummary: (id: string, value: ProjectInitializationSummaryInfo | null) => void;
  refreshUnits: (id: string) => Promise<void>;
}
interface Options {
  project: ProjectInfo | null; repositories: ProjectRepositoryInfo[]; selectedRepositoryId: string | null;
  initialization: ProjectInitializationInfo | null; guardrails: ProjectInitializationGuardrailInfo[];
  summary: ProjectInitializationSummaryInfo | null; modelProfile: ModelProfileInfo | null;
  evidence: EvidenceActions; notify: (kind: "success" | "error", message: string) => void;
}

export function useProjectInitializationWorkflow(options: Options) {
  const { project, repositories, selectedRepositoryId, initialization, guardrails, summary,
    modelProfile, evidence, notify } = options;
  const [dialogOpen, setDialogOpen] = useState(false); const [repositoryIds, setRepositoryIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const [summaryGenerating, setSummaryGenerating] = useState(false);
  const [detailsView, setDetailsView] = useState<InitializeDetailsView | null>(null);
  const [interviewOpen, setInterviewOpen] = useState(false); const [interviewError, setInterviewError] = useState<string | null>(null);
  const [scope, setScope] = useState<InterviewScope>("project"); const [repositoryId, setRepositoryId] = useState("");
  const [kind, setKind] = useState<ProjectInitializationGuardrailKind>("fragile");
  const [pathPattern, setPathPattern] = useState(""); const [content, setContent] = useState("");
  const [drafts, setDrafts] = useState<ProjectInitializationGuardrailInput[]>([]);

  useEffect(() => { if (!initialization) { setDetailsView(null); setInterviewOpen(false); } }, [initialization]);
  function openDialog() { if (!project) { setError("Select a project before initializing it."); return; }
    setError(null); setRepositoryIds(repositories.map(({ id }) => id)); setDialogOpen(true); }
  function closeDialog() { if (!loading) { setDialogOpen(false); setError(null); } }
  function toggleRepository(id: string, selected: boolean) {
    setRepositoryIds((current) => selected ? uniqueIds([...current, id]) : current.filter((value) => value !== id));
  }
  async function createInitialization() {
    if (!project) { setError("Select a project before initializing it."); return; }
    if (repositoryIds.length === 0) { setError("Select at least one repository."); return; }
    setLoading(true); setError(null);
    try { const value = await invokeCommand<ProjectInitializationInfo>("create_project_initialization",
      { request: { projectId: project.id, repositoryIds } }); evidence.setInitialization(value); setDialogOpen(false); }
    catch (reason) { setError(errorText(reason)); } finally { setLoading(false); }
  }
  async function collectFacts() {
    if (!initialization) { notify("error", "Start Project Initialize before collecting facts."); return; }
    setLoading(true); try { const value = await invokeCommand<ProjectInitializationFactInfo[]>(
      "collect_project_initialization_facts", { initializationId: initialization.id });
      evidence.setFacts(initialization.id, value); evidence.advanceStatus(initialization, "facts");
      notify("success", `Facts collected for ${initialization.repositoryCount} repositories.`);
    } catch (reason) { notify("error", errorText(reason)); } finally { setLoading(false); }
  }
  async function analyzeMarkdown() {
    if (!initialization) { notify("error", "Start Project Initialize before analyzing markdown."); return; }
    setLoading(true); try { const value = await invokeCommand<ProjectInitializationMarkdownFindingInfo[]>(
      "analyze_project_initialization_markdown", { initializationId: initialization.id });
      evidence.setMarkdown(initialization.id, value); evidence.advanceStatus(initialization, "markdown");
      notify("success", `Markdown analyzed with ${value.length} findings.`);
    } catch (reason) { notify("error", errorText(reason)); } finally { setLoading(false); }
  }
  function openInterview() {
    if (!initialization) { notify("error", "Start Project Initialize before the interview."); return; }
    setDrafts(guardrails.map(toInput)); setScope("project"); setRepositoryId(selectedRepositoryId ?? repositories[0]?.id ?? "");
    setKind("fragile"); setPathPattern(""); setContent(""); setInterviewError(null); setInterviewOpen(true);
  }
  function closeInterview() { if (!loading) { setInterviewOpen(false); setInterviewError(null); } }
  function addGuardrail() { const text = content.trim();
    if (!text) { setInterviewError("Describe the guardrail before adding it."); return; }
    const target = scope === "repository" ? repositoryId : null;
    if (scope === "repository" && !target) { setInterviewError("Choose a repository for this guardrail."); return; }
    setDrafts((current) => [...current, { repositoryId: target, kind, pathPattern: pathPattern.trim() || null, content: text }]);
    setPathPattern(""); setContent(""); setInterviewError(null);
  }
  async function saveGuardrails() {
    if (!initialization) { setInterviewError("Start Project Initialize before saving interview guardrails."); return; }
    if (drafts.length === 0) { setInterviewError("Add at least one guardrail before saving."); return; }
    setLoading(true); setInterviewError(null);
    try { const value = await invokeCommand<ProjectInitializationGuardrailInfo[]>("save_project_initialization_guardrails",
      { request: { initializationId: initialization.id, guardrails: drafts } });
      evidence.setGuardrails(initialization.id, value); evidence.advanceStatus(initialization, "interview");
      setInterviewOpen(false); notify("success", `Interview saved with ${value.length} guardrails.`);
    } catch (reason) { setInterviewError(errorText(reason)); } finally { setLoading(false); }
  }
  async function generateSummary() {
    if (!initialization) { notify("error", "Start Project Initialize before generating a summary."); return; }
    if (!modelProfile || modelProfile.status !== "selectable") { notify("error", "Choose an available synthesis model before generating a summary."); return; }
    setLoading(true); setSummaryGenerating(true); try { const value = await invokeCommand<ProjectInitializationSummaryInfo>(
      "generate_project_initialization_summary", { request: { initializationId: initialization.id, modelProfileId: modelProfile.id } });
      evidence.setSummary(initialization.id, value); evidence.advanceStatus(initialization, "summary"); notify("success", "Summary draft generated.");
    } catch (reason) { notify("error", errorText(reason)); } finally { setSummaryGenerating(false); setLoading(false); }
  }
  async function approveSummary() {
    if (!summary) { notify("error", "Generate a summary before approving it."); return; }
    setLoading(true); try { const value = await invokeCommand<ProjectInitializationSummaryInfo>(
      "approve_project_initialization_summary", { summaryId: summary.id }); evidence.setSummary(value.initializationId, value);
      await evidence.refreshUnits(value.initializationId); notify("success", "Summary approved as active project profile.");
    } catch (reason) { notify("error", errorText(reason)); } finally { setLoading(false); }
  }
  return { dialogOpen, repositoryIds, loading, summaryGenerating, error, detailsView, interviewOpen, interviewError,
    scope, repositoryId, kind, pathPattern, content, drafts, openDialog, closeDialog, toggleRepository,
    createInitialization, collectFacts, analyzeMarkdown, openInterview, closeInterview, addGuardrail,
    removeGuardrail: (index: number) => setDrafts((current) => current.filter((_, item) => item !== index)),
    saveGuardrails, generateSummary, approveSummary, setDetailsView, changeScope: setScope,
    changeRepositoryId: setRepositoryId, changeKind: setKind, changePathPattern: setPathPattern, changeContent: setContent };
}
function toInput(value: ProjectInitializationGuardrailInfo): ProjectInitializationGuardrailInput {
  return { repositoryId: value.repositoryId, kind: value.kind, pathPattern: value.pathPattern, content: value.content };
}
