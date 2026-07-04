import { Folder, Plus, Radio } from "lucide-react";
import { useMemo } from "react";
import { useAppStore } from "../store/appStore";

export function Sidebar() {
  const projects = useAppStore((state) => state.projects);
  const sessions = useAppStore((state) => state.sessions);
  const selectedProjectId = useAppStore((state) => state.selectedProjectId);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const projectName = useAppStore((state) => state.projectName);
  const projectPath = useAppStore((state) => state.projectPath);
  const busy = useAppStore((state) => state.busy);
  const setSelectedProject = useAppStore((state) => state.setSelectedProject);
  const setActiveSession = useAppStore((state) => state.setActiveSession);
  const setProjectName = useAppStore((state) => state.setProjectName);
  const setProjectPath = useAppStore((state) => state.setProjectPath);
  const createProject = useAppStore((state) => state.createProject);
  const startSession = useAppStore((state) => state.startSession);

  const sessionsByProject = useMemo(
    () =>
      sessions.reduce<Record<string, typeof sessions>>((groups, session) => {
        groups[session.project_id] = [...(groups[session.project_id] ?? []), session];
        return groups;
      }, {}),
    [sessions],
  );

  return (
    <aside className="sidebar" aria-label="Projects">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          CB
        </span>
        <div>
          <h1>Code Buddy</h1>
          <p>Local agent control</p>
        </div>
      </div>

      <button
        className="primary-action full"
        type="button"
        onClick={() => void startSession()}
        disabled={busy || projects.length === 0}
      >
        <Plus size={16} aria-hidden="true" />
        <span>New session</span>
      </button>

      <nav className="project-list" aria-label="Project sessions">
        {projects.length === 0 ? (
          <div className="empty-inline">
            <Folder size={18} aria-hidden="true" />
            <span>No projects</span>
          </div>
        ) : (
          projects.map((project) => {
            const projectSessions = sessionsByProject[project.id] ?? [];
            const selected = selectedProjectId === project.id;
            return (
              <section className="project-group" key={project.id}>
                <button
                  className={`project-heading ${selected ? "selected" : ""}`}
                  type="button"
                  onClick={() => setSelectedProject(project.id)}
                >
                  <span>
                    <Folder size={15} aria-hidden="true" />
                    <strong>{project.name}</strong>
                  </span>
                  <small>{projectSessions.length}</small>
                </button>
                <p title={project.path}>{project.path}</p>
                <div className="session-list">
                  {projectSessions.map((session) => (
                    <button
                      className={`session-item ${
                        activeSessionId === session.id ? "active" : ""
                      }`}
                      type="button"
                      key={session.id}
                      onClick={() => setActiveSession(session.id)}
                    >
                      <span className={`state-dot ${session.state}`} aria-hidden="true" />
                      <span>
                        <strong>{session.title}</strong>
                        <small>
                          {session.agent_name} - {session.state}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </nav>

      <form
        className="project-form"
        onSubmit={(event) => {
          event.preventDefault();
          void createProject();
        }}
      >
        <label>
          <span>Name</span>
          <input
            aria-label="Project name"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="code-buddy"
          />
        </label>
        <label>
          <span>Path</span>
          <input
            aria-label="Project path"
            value={projectPath}
            onChange={(event) => setProjectPath(event.target.value)}
            placeholder="/path/to/project"
          />
        </label>
        <button className="secondary-action full" type="submit" disabled={busy}>
          <Radio size={15} aria-hidden="true" />
          <span>Add project</span>
        </button>
      </form>
    </aside>
  );
}
