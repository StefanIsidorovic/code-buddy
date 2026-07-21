import { useEffect, useRef, useState } from "react";
import { errorText } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type { KnowledgeUnitInfo, ProjectInitializationFactInfo, ProjectInitializationGuardrailInfo,
  ProjectInitializationInfo, ProjectInitializationMarkdownFindingInfo,
  ProjectInitializationSummaryInfo } from "../../types/domain";

interface Options {
  projectId: string | null;
  notifyError: (message: string) => void;
}

export function useInitializationEvidence({ projectId, notifyError }: Options) {
  const [initializations, setInitializations] = useState<Record<string, ProjectInitializationInfo>>({});
  const [facts, setFacts] = useState<Record<string, ProjectInitializationFactInfo[]>>({});
  const [markdown, setMarkdown] = useState<Record<string, ProjectInitializationMarkdownFindingInfo[]>>({});
  const [guardrails, setGuardrails] = useState<Record<string, ProjectInitializationGuardrailInfo[]>>({});
  const [summaries, setSummaries] = useState<Record<string, ProjectInitializationSummaryInfo | null>>({});
  const [units, setUnits] = useState<Record<string, KnowledgeUnitInfo[]>>({});
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const projectRequest = useRef(0); const evidenceRequest = useRef(0);
  const initialization = projectId ? initializations[projectId] ?? null : null;
  const initializationId = initialization?.id ?? null;

  useEffect(() => { void refreshInitialization(projectId); }, [projectId]);
  useEffect(() => { void refreshEvidence(initializationId); }, [initializationId]);

  async function refreshInitialization(nextProjectId: string | null) {
    const request = ++projectRequest.current;
    if (!nextProjectId) return;
    try {
      const next = await invokeCommand<ProjectInitializationInfo[]>("list_project_initializations",
        { projectId: nextProjectId }) ?? [];
      if (request !== projectRequest.current) return;
      setInitializations((current) => { const updated = { ...current };
        if (next[0]) updated[nextProjectId] = next[0]; else delete updated[nextProjectId]; return updated; });
    } catch (error) { if (request === projectRequest.current) notifyError(errorText(error)); }
  }

  async function refreshEvidence(nextInitializationId: string | null) {
    const request = ++evidenceRequest.current;
    if (!nextInitializationId) { setUnitsError(null); return; }
    setUnitsLoading(true); setUnitsError(null);
    const commands = await Promise.allSettled([
      invokeCommand<ProjectInitializationFactInfo[]>("list_project_initialization_facts", { initializationId: nextInitializationId }),
      invokeCommand<ProjectInitializationMarkdownFindingInfo[]>("list_project_initialization_markdown_findings", { initializationId: nextInitializationId }),
      invokeCommand<ProjectInitializationGuardrailInfo[]>("list_project_initialization_guardrails", { initializationId: nextInitializationId }),
      invokeCommand<ProjectInitializationSummaryInfo | null>("list_project_initialization_summary", { initializationId: nextInitializationId }),
      invokeCommand<KnowledgeUnitInfo[]>("list_project_initialization_knowledge_units", { initializationId: nextInitializationId }),
    ]);
    if (request !== evidenceRequest.current) return;
    const [factsResult, markdownResult, guardrailResult, summaryResult, unitsResult] = commands;
    if (factsResult.status === "fulfilled") setFacts((current) => ({ ...current, [nextInitializationId]: factsResult.value ?? [] }));
    else notifyError(errorText(factsResult.reason));
    if (markdownResult.status === "fulfilled") setMarkdown((current) => ({ ...current, [nextInitializationId]: markdownResult.value ?? [] }));
    else notifyError(errorText(markdownResult.reason));
    if (guardrailResult.status === "fulfilled") setGuardrails((current) => ({ ...current, [nextInitializationId]: guardrailResult.value ?? [] }));
    else notifyError(errorText(guardrailResult.reason));
    if (summaryResult.status === "fulfilled") setSummaries((current) => ({ ...current, [nextInitializationId]: summaryResult.value ?? null }));
    else notifyError(errorText(summaryResult.reason));
    if (unitsResult.status === "fulfilled") setUnits((current) => ({ ...current, [nextInitializationId]: unitsResult.value ?? [] }));
    else setUnitsError(errorText(unitsResult.reason));
    setUnitsLoading(false);
  }

  function setInitialization(value: ProjectInitializationInfo) {
    setInitializations((current) => ({ ...current, [value.projectId]: value }));
  }
  function advanceStatus(value: ProjectInitializationInfo, status: ProjectInitializationInfo["status"]) {
    setInitializations((current) => current[value.projectId]?.id === value.id
      ? { ...current, [value.projectId]: { ...current[value.projectId], status } } : current);
  }

  async function refreshUnits(id: string) {
    setUnitsLoading(true); setUnitsError(null);
    try {
      const value = await invokeCommand<KnowledgeUnitInfo[]>("list_project_initialization_knowledge_units",
        { initializationId: id }) ?? [];
      setUnits((current) => ({ ...current, [id]: value }));
    } catch (error) { setUnitsError(errorText(error)); }
    finally { setUnitsLoading(false); }
  }

  return { initialization, facts: initializationId ? facts[initializationId] ?? [] : [],
    markdown: initializationId ? markdown[initializationId] ?? [] : [],
    guardrails: initializationId ? guardrails[initializationId] ?? [] : [],
    summary: initializationId ? summaries[initializationId] ?? null : null,
    units: initializationId ? units[initializationId] ?? [] : [], unitsLoading, unitsError,
    setInitialization, advanceStatus,
    setFacts: (id: string, value: ProjectInitializationFactInfo[]) => setFacts((current) => ({ ...current, [id]: value })),
    setMarkdown: (id: string, value: ProjectInitializationMarkdownFindingInfo[]) => setMarkdown((current) => ({ ...current, [id]: value })),
    setGuardrails: (id: string, value: ProjectInitializationGuardrailInfo[]) => setGuardrails((current) => ({ ...current, [id]: value })),
    setSummary: (id: string, value: ProjectInitializationSummaryInfo | null) => setSummaries((current) => ({ ...current, [id]: value })),
    refreshUnits,
    removeProject: (id: string) => setInitializations((current) => { const next = { ...current }; delete next[id]; return next; }) };
}
