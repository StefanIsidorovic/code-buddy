import { useEffect, useMemo, useRef, useState } from "react";
import { errorText, uniqueIds } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type { KnowledgeItemInfo, ProjectInitializationInfo, ProjectInitializationSummaryInfo,
  TaskContextSelectionInfo } from "../../types/domain";

interface Options {
  projectId: string | null; activeTranscriptId: string | null;
  initialization: ProjectInitializationInfo | null; summary: ProjectInitializationSummaryInfo | null;
  prompt: string; repositoryId: string | null;
}

export function useKnowledgeWorkspace(options: Options) {
  const { projectId, activeTranscriptId, initialization, summary, prompt, repositoryId } = options;
  const [items, setItems] = useState<KnowledgeItemInfo[]>([]); const [attachedIds, setAttachedIds] = useState<string[]>([]);
  const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [kind, setKind] = useState("decision");
  const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false); const [preview, setPreview] = useState<TaskContextSelectionInfo | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false); const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null); const loadRequest = useRef(0);
  const attachedItems = useMemo(() => items.filter((item) => attachedIds.includes(item.id)), [attachedIds, items]);

  useEffect(() => { void refresh(projectId); }, [projectId]);
  async function refresh(nextProjectId = projectId) {
    const request = ++loadRequest.current; setLoading(true); setError(null);
    try { const value = await invokeCommand<KnowledgeItemInfo[]>("list_knowledge_items", { projectId: nextProjectId ?? null }) ?? [];
      if (request !== loadRequest.current) return; const next = Array.isArray(value) ? value : [];
      setItems(next); setAttachedIds((current) => current.filter((id) => next.some((item) => item.id === id)));
    } catch (reason) { if (request === loadRequest.current) setError(errorText(reason)); }
    finally { if (request === loadRequest.current) setLoading(false); }
  }
  async function attach(itemId: string, transcriptId = activeTranscriptId) {
    if (!transcriptId) return;
    try { await invokeCommand<KnowledgeItemInfo[]>("attach_knowledge_to_transcript_session",
      { sessionId: transcriptId, knowledgeItemId: itemId }); }
    catch (reason) { setError(errorText(reason)); }
  }
  async function create() {
    setLoading(true); setError(null);
    try { const item = await invokeCommand<KnowledgeItemInfo>("create_knowledge_item", { request: {
      projectId, title, body, kind, scope: projectId ? "project" : "global",
      sourceTranscriptSessionId: activeTranscriptId } });
      setItems((current) => [item, ...current.filter(({ id }) => id !== item.id)]);
      setAttachedIds((current) => uniqueIds([...current, item.id])); setTitle(""); setBody(""); setKind("decision");
      setDialogOpen(false); await attach(item.id);
    } catch (reason) { setError(errorText(reason)); } finally { setLoading(false); }
  }
  async function toggle(item: KnowledgeItemInfo, attached: boolean) {
    setError(null); setAttachedIds((current) => attached ? uniqueIds([...current, item.id]) : current.filter((id) => id !== item.id));
    if (attached) await attach(item.id);
  }
  async function attachSelected(transcriptId: string) {
    try { for (const itemId of attachedIds) await invokeCommand<KnowledgeItemInfo[]>(
      "attach_knowledge_to_transcript_session", { sessionId: transcriptId, knowledgeItemId: itemId }); }
    catch (reason) { setError(errorText(reason)); }
  }
  async function previewContext() {
    if (!initialization || summary?.status !== "approved") {
      setPreviewError("Approve a Summary before previewing task context."); setPreviewOpen(true); return;
    }
    setPreviewOpen(true); setPreviewLoading(true); setPreviewError(null);
    try { const value = await invokeCommand<TaskContextSelectionInfo>("select_project_task_context", { request: {
      initializationId: initialization.id, task: prompt, repositoryId, paths: [], characterBudget: 6000 } }); setPreview(value); }
    catch (reason) { setPreview(null); setPreviewError(errorText(reason)); } finally { setPreviewLoading(false); }
  }
  function closeDialog() { if (!loading) { setDialogOpen(false); setError(null); setTitle(""); setBody(""); setKind("decision"); } }
  return { items, attachedIds, attachedItems, title, body, kind, error, loading, dialogOpen,
    preview, previewOpen, previewLoading, previewError, refresh, create, toggle, attachSelected, previewContext,
    openDialog: () => { setError(null); setDialogOpen(true); }, closeDialog,
    changeTitle: setTitle, changeBody: setBody, changeKind: setKind, closePreview: () => setPreviewOpen(false) };
}
