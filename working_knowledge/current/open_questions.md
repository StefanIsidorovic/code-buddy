# Open Questions

## Blocking
- None.

## Non-Blocking
- Should task knowledge artifacts store only curated outputs or also bounded intermediate reasoning summaries?
- May a future Task span multiple ACP sessions, or should continuation always create a new linked session?
- Which measured Task outcomes should later calibrate classifier weights and confidence without silently changing historical assessments?
- Should Review brief finding resolution later persist per Task/user, or remain a transient Activity-panel aid?
- Should the first structured-plan editor support arbitrary dependency edges, or keep execution ordered until isolated worktree scheduling is implemented?
- Which ACP-advertised model metadata can safely support weak/mid/strong routing before availability and cost signals become authoritative?

## Resolved
- Should ACP Controls, Task phases, receipt histories, and Output remain one stacked page?: No; Agent is the default focused view with controls/output, while Task and Activity are separate local views.
- Is a Task identical to a transcript?: No; Task owns lifecycle and task knowledge, while transcript owns ordered conversation events.
- What creates the first Task?: The first user prompt in a new ACP/transcript session.
- Are later prompts in that session new tasks?: No; they continue the existing Task.
- What is the canonical phase order?: Analysis, planning, execution, review; intake is Task creation and reusable learning is captured by review.
- Who chooses Task complexity?: The backend proposes an explainable initial profile, analysis may propose a revision, and the user has final override control.
- Are Summary and coding-agent models one shared choice?: No; Summary uses synthesis profiles, while the active ACP agent advertises and owns its session-scoped Coding model choice.
- Should each phase automatically advance?: No; every phase requires explicit start and evidence-backed completion, and the next phase remains pending until separately started.
