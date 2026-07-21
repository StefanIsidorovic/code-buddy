import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { errorText, folderNameFromPath } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type { ProjectInfo, ProjectRepositoryInfo } from "../../types/domain";

interface UseProjectCatalogOptions {
  onBusyChange: (busy: boolean) => void;
  notify: (kind: "success" | "error", message: string) => void;
}

export function useProjectCatalog({ onBusyChange, notify }: UseProjectCatalogOptions) {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectFolderPicking, setProjectFolderPicking] = useState(false);
  const [repositories, setRepositories] = useState<ProjectRepositoryInfo[]>([]);
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<string | null>(null);
  const [repositoryDialogOpen, setRepositoryDialogOpen] = useState(false);
  const [repositoryName, setRepositoryName] = useState("");
  const [repositoryPath, setRepositoryPath] = useState("");
  const [repositoryLoading, setRepositoryLoading] = useState(false);
  const repositoryRequest = useRef(0);

  const selectedProject = useMemo(() => projects.find(({ id }) => id === selectedProjectId) ?? null,
    [projects, selectedProjectId]);
  const selectedRepository = useMemo(() => repositories.find(({ id }) => id === selectedRepositoryId) ?? null,
    [repositories, selectedRepositoryId]);

  useEffect(() => { void refreshProjects(); }, []);
  useEffect(() => { void refreshRepositories(selectedProjectId); }, [selectedProjectId]);

  async function refreshProjects() {
    setProjectLoading(true);
    try {
      const next = await invokeCommand<ProjectInfo[]>("list_projects");
      setProjects(next);
      setSelectedProjectId((current) => current && next.some(({ id }) => id === current)
        ? current : next[0]?.id ?? null);
    } catch (error) { notify("error", errorText(error)); }
    finally { setProjectLoading(false); }
  }

  async function createProject() {
    onBusyChange(true);
    try {
      const project = await invokeCommand<ProjectInfo>("create_project", {
        request: { name: projectName, path: projectPath },
      });
      setProjects((current) => [project, ...current.filter(({ id }) => id !== project.id)]);
      setSelectedProjectId(project.id); setProjectName(""); setProjectPath("");
      notify("success", `${project.name} added.`);
    } catch (error) { notify("error", errorText(error)); }
    finally { onBusyChange(false); }
  }

  async function chooseProjectFolder() {
    setProjectFolderPicking(true);
    try {
      const selected = await open({ directory: true, multiple: false, title: "Choose project folder" });
      if (!selected || Array.isArray(selected)) return;
      setProjectPath(selected);
      setProjectName((current) => current.trim() || folderNameFromPath(selected));
    } catch (error) { notify("error", errorText(error)); }
    finally { setProjectFolderPicking(false); }
  }

  async function refreshRepositories(projectId = selectedProjectId) {
    const request = ++repositoryRequest.current;
    if (!projectId) { setRepositories([]); setSelectedRepositoryId(null); return; }
    setRepositoryLoading(true);
    try {
      const next = await invokeCommand<ProjectRepositoryInfo[]>("list_project_repositories", { projectId }) ?? [];
      if (request !== repositoryRequest.current) return;
      setRepositories(next);
      setSelectedRepositoryId((current) => current && next.some(({ id }) => id === current)
        ? current : next[0]?.id ?? null);
    } catch (error) { if (request === repositoryRequest.current) notify("error", errorText(error)); }
    finally { if (request === repositoryRequest.current) setRepositoryLoading(false); }
  }

  async function createRepository() {
    if (!selectedProject) { notify("error", "Select a project before adding a repository."); return; }
    setRepositoryLoading(true);
    try {
      const repository = await invokeCommand<ProjectRepositoryInfo>("create_project_repository", {
        request: { projectId: selectedProject.id, name: repositoryName, path: repositoryPath },
      });
      setRepositories((current) => [repository, ...current.filter(({ id }) => id !== repository.id)]);
      setSelectedRepositoryId(repository.id); setRepositoryName(""); setRepositoryPath("");
    } catch (error) { notify("error", errorText(error)); }
    finally { setRepositoryLoading(false); }
  }

  async function deleteRepository(repositoryId: string) {
    setRepositoryLoading(true);
    try {
      await invokeCommand("delete_project_repository", { repositoryId });
      setRepositories((current) => {
        const next = current.filter(({ id }) => id !== repositoryId);
        setSelectedRepositoryId((selected) => selected === repositoryId ? next[0]?.id ?? null : selected);
        return next;
      });
    } catch (error) { notify("error", errorText(error)); }
    finally { setRepositoryLoading(false); }
  }

  function removeProject(projectId: string) {
    setProjects((current) => current.filter(({ id }) => id !== projectId));
    if (selectedProjectId === projectId) { setSelectedProjectId(null); setRepositories([]); setSelectedRepositoryId(null); }
  }

  return { projects, selectedProjectId, selectedProject, repositories, selectedRepository,
    workspaceDialogOpen, projectName, projectPath, projectLoading, projectFolderPicking,
    repositoryDialogOpen, repositoryName, repositoryPath, repositoryLoading,
    openWorkspaceDialog: () => setWorkspaceDialogOpen(true), closeWorkspaceDialog: () => setWorkspaceDialogOpen(false),
    changeProjectName: setProjectName, changeProjectPath: setProjectPath, chooseProjectFolder,
    createProject, refreshProjects, selectProject: (id: string) => { setSelectedProjectId(id); setWorkspaceDialogOpen(false); },
    openRepositoryDialog: () => setRepositoryDialogOpen(true), closeRepositoryDialog: () => setRepositoryDialogOpen(false),
    changeRepositoryName: setRepositoryName, changeRepositoryPath: setRepositoryPath,
    createRepository, deleteRepository, refreshRepositories,
    selectRepository: (id: string) => { setSelectedRepositoryId(id); setRepositoryDialogOpen(false); },
    removeProject };
}
