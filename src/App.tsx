import "./App.css";

const projects = [
  {
    name: "code-buddy",
    path: "/home/stefan/code-buddy",
    sessions: [
      { name: "Codex planning", agent: "Codex", state: "running" },
      { name: "Claude review", agent: "Claude", state: "idle" },
    ],
  },
];

const transcript = [
  {
    role: "assistant",
    title: "Session initialized",
    body: "Agent detection and project context are ready for the next prompt.",
  },
  {
    role: "tool",
    title: "Tool call",
    body: "resolve_agents_md({ cwd: project.path })",
  },
];

function App() {
  return (
    <main className="app-shell" aria-label="Code Buddy">
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

        <button className="primary-action" type="button">
          New session
        </button>

        <nav className="project-list">
          {projects.map((project) => (
            <section className="project-group" key={project.name}>
              <div className="project-heading">
                <strong>{project.name}</strong>
                <span>{project.sessions.length}</span>
              </div>
              <p>{project.path}</p>
              <div className="session-list">
                {project.sessions.map((session) => (
                  <button className="session-item" type="button" key={session.name}>
                    <span className={`state-dot ${session.state}`} aria-hidden="true" />
                    <span>
                      <strong>{session.name}</strong>
                      <small>{session.agent}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </nav>
      </aside>

      <section className="workspace" aria-label="Session workspace">
        <header className="topbar">
          <div className="tab-strip" aria-label="Sessions">
            <button className="session-tab active" type="button">
              <span className="agent-badge">Codex</span>
              <span>Planning</span>
            </button>
            <button className="session-tab" type="button">
              <span className="agent-badge muted">Claude</span>
              <span>Review</span>
            </button>
          </div>
          <div className="run-controls">
            <select aria-label="Model">
              <option>Default model</option>
              <option>gpt-5-codex</option>
              <option>sonnet</option>
            </select>
            <button className="secondary-action" type="button">
              Stop
            </button>
            <button className="primary-action compact" type="button">
              Start
            </button>
          </div>
        </header>

        <div className="content-grid">
          <section className="main-pane" aria-label="Session output">
            <div className="view-toggle" role="tablist" aria-label="View mode">
              <button className="active" type="button" role="tab" aria-selected="true">
                Terminal
              </button>
              <button type="button" role="tab" aria-selected="false">
                Chat
              </button>
            </div>

            <div className="terminal-surface" aria-label="Terminal output">
              <div className="terminal-line muted">code-buddy session ready</div>
              <div className="terminal-line">$ codex --model default</div>
              <div className="terminal-line accent">AGENTS.md: active</div>
              <div className="terminal-line">Waiting for input...</div>
            </div>

            <div className="command-bar">
              <textarea aria-label="Prompt" placeholder="Send a prompt to the active agent" />
              <button className="primary-action compact" type="button">
                Send
              </button>
            </div>
          </section>

          <aside className="details-panel" aria-label="Session details">
            <section className="status-block">
              <h2>Session</h2>
              <dl>
                <div>
                  <dt>State</dt>
                  <dd>running</dd>
                </div>
                <div>
                  <dt>Agent</dt>
                  <dd>Codex</dd>
                </div>
                <div>
                  <dt>AGENTS.md</dt>
                  <dd>active</dd>
                </div>
              </dl>
            </section>

            <section className="status-block">
              <h2>Activity</h2>
              <div className="activity-list">
                {transcript.map((item) => (
                  <article className="activity-item" key={item.title}>
                    <span>{item.role}</span>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}

export default App;
