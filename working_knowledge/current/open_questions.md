# Open Questions

## Blocking
- None.

## Non-Blocking
- Should each phase run automatically in sequence or require explicit user approval before the next phase?
- Should task knowledge artifacts store only curated outputs or also bounded intermediate reasoning summaries?
- May a future Task span multiple ACP sessions, or should continuation always create a new linked session?
- Which measured Task outcomes should later calibrate classifier weights and confidence without silently changing historical assessments?

## Resolved
- Is a Task identical to a transcript?: No; Task owns lifecycle and task knowledge, while transcript owns ordered conversation events.
- What creates the first Task?: The first user prompt in a new ACP/transcript session.
- Are later prompts in that session new tasks?: No; they continue the existing Task.
- What is the canonical phase order?: Analysis, planning, execution, review; intake is Task creation and reusable learning is captured by review.
- Who chooses Task complexity?: The backend proposes an explainable initial profile, analysis may propose a revision, and the user has final override control.
- Are Summary and coding-agent models one shared choice?: No; Summary uses synthesis profiles, while the active ACP agent advertises and owns its session-scoped Coding model choice.
