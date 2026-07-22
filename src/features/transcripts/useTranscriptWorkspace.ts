import { useEffect, useMemo, useRef, useState } from "react";
import { coalesceTranscriptEvents, errorText, transcriptEventToAcpEvent } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type { AcpSessionEvent, TaskInfo, TranscriptEventInfo, TranscriptSessionInfo } from "../../types/domain";

interface Options { projectId: string | null; onShowAcp: () => void }

export function useTranscriptWorkspace({ projectId, onShowAcp }: Options) {
  const [session, setSession] = useState<TranscriptSessionInfo | null>(null);
  const [sessions, setSessions] = useState<TranscriptSessionInfo[]>([]);
  const [tasks, setTasks] = useState<Record<string, TaskInfo>>({});
  const [openedSession, setOpenedSession] = useState<TranscriptSessionInfo | null>(null);
  const [openedEvents, setOpenedEvents] = useState<AcpSessionEvent[]>([]);
  const [liveEvents, setLiveEvents] = useState<TranscriptEventInfo[]>([]);
  const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState(""); const [renameTitle, setRenameTitle] = useState("");
  const sessionRef = useRef<TranscriptSessionInfo | null>(null); const tasksRef = useRef<Record<string, TaskInfo>>({});
  const openRequest = useRef(0); const loadRequest = useRef(0);
  const selectedId = openedSession?.id ?? session?.id ?? null;
  const selectedSession = useMemo(() => sessions.find(({ id }) => id === selectedId) ?? null, [selectedId, sessions]);
  const activeTask = session ? tasks[session.id] ?? null : null;

  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { setRenameTitle(selectedSession?.title ?? ""); }, [selectedSession?.id, selectedSession?.title]);
  useEffect(() => { void refresh(projectId); }, [projectId]);

  async function refresh(nextProjectId = projectId) {
    const request = ++loadRequest.current; setLoading(true); setError(null); tasksRef.current = {}; setTasks({});
    try {
      const [nextSessions, nextTasks] = await Promise.all([
        invokeCommand<TranscriptSessionInfo[]>("list_transcript_sessions", { projectId: nextProjectId ?? null }),
        nextProjectId ? invokeCommand<TaskInfo[]>("list_project_tasks", { projectId: nextProjectId }) : Promise.resolve([]),
      ]);
      if (request !== loadRequest.current) return;
      setSessions(nextSessions ?? []); const indexed = Object.fromEntries((nextTasks ?? []).map((task) => [task.transcriptSessionId, task]));
      tasksRef.current = indexed; setTasks(indexed);
      if (openedSession && !(nextSessions ?? []).some(({ id }) => id === openedSession.id)) {
        setOpenedSession(null); setOpenedEvents([]);
      }
    } catch (reason) { if (request === loadRequest.current) setError(errorText(reason)); }
    finally { if (request === loadRequest.current) setLoading(false); }
  }
  async function create(runtime: string, source: string, title: string) {
    setError(null);
    try { const value = await invokeCommand<TranscriptSessionInfo | null>("create_transcript_session",
      { request: { projectId, runtime, source, title } });
      sessionRef.current = value; setSession(value);
      if (!value) return null; setOpenedSession(null); setOpenedEvents([]); setLiveEvents([]);
      setSessions((current) => [value, ...current.filter(({ id }) => id !== value.id)]); return value;
    } catch (reason) { sessionRef.current = null; setSession(null); setError(errorText(reason)); return null; }
  }
  async function openSaved(value: TranscriptSessionInfo) {
    const request = ++openRequest.current; onShowAcp(); setOpenedSession(value); setOpenedEvents([]); setLoading(true); setError(null);
    try { const events = await invokeCommand<TranscriptEventInfo[]>("list_transcript_events", { sessionId: value.id }) ?? [];
      if (request !== openRequest.current) return; setOpenedSession(value); setOpenedEvents(events.map(transcriptEventToAcpEvent)); }
    catch (reason) { if (request === openRequest.current) setError(errorText(reason)); }
    finally { if (request === openRequest.current) setLoading(false); }
  }
  async function renameSelected() {
    if (!selectedSession || !renameTitle.trim()) return; setLoading(true); setError(null);
    try { upsertSession(await invokeCommand<TranscriptSessionInfo>("rename_transcript_session",
      { request: { sessionId: selectedSession.id, title: renameTitle } })); }
    catch (reason) { setError(errorText(reason)); } finally { setLoading(false); }
  }
  function upsertSession(value: TranscriptSessionInfo) {
    setSessions((current) => current.map((item) => item.id === value.id ? value : item));
    setSession((current) => current?.id === value.id ? value : current);
    setOpenedSession((current) => current?.id === value.id ? value : current);
    if (sessionRef.current?.id === value.id) sessionRef.current = value;
  }
  function showLive() { ++openRequest.current; onShowAcp(); setOpenedSession(null); setOpenedEvents([]); }
  async function record(transcriptId: string | null | undefined, events: AcpSessionEvent[]) {
    if (!transcriptId) return []; const clean = coalesceTranscriptEvents(events.map(({ kind, content }) => ({ kind, content }))
      .filter(({ content }) => content.trim().length > 0)); if (clean.length === 0) return []; setError(null);
    try { const inserted = await invokeCommand<TranscriptEventInfo[]>("append_transcript_events",
      { sessionId: transcriptId, events: clean }); touch(transcriptId, inserted); return inserted;
    } catch (reason) { setError(errorText(reason)); return []; }
  }
  function touch(id: string, inserted: TranscriptEventInfo[]) {
    if (inserted.length === 0) return; const updatedAt = inserted[inserted.length - 1].createdAt;
    const update = (value: TranscriptSessionInfo) => ({ ...value, updatedAt, eventCount: value.eventCount + inserted.length });
    setSessions((current) => current.map((value) => value.id === id ? update(value) : value));
    setSession((current) => current?.id === id ? update(current) : current);
    if (sessionRef.current?.id === id) setLiveEvents((current) => [...current, ...inserted]);
    if (openedSession?.id === id) setOpenedEvents((current) => [...current, ...inserted.map(transcriptEventToAcpEvent)]);
  }
  function upsertTask(task: TaskInfo) { tasksRef.current = { ...tasksRef.current, [task.transcriptSessionId]: task };
    setTasks((current) => ({ ...current, [task.transcriptSessionId]: task })); }
  return { session, sessions, openedSession, openedEvents, liveEvents, error, loading, filter, renameTitle, selectedId,
    activeTask, refresh, create, openSaved, renameSelected, showLive, record,
    changeFilter: setFilter, changeRenameTitle: setRenameTitle, getActiveSessionId: () => sessionRef.current?.id ?? null,
    getTask: (id: string) => tasksRef.current[id] ?? null, upsertTask };
}
