# AGENTS.md

## Purpose

This repository uses a structured, state-aware workflow for coding agents.

The goal is to ensure that any agent working in this workspace behaves
deterministically, performs real research before coding, produces explicit
plans, tests every change, performs review cycles, and keeps workspace
knowledge up to date.

This file is the primary source of agent instructions for the repository.

---

## Workspace Layout

The workspace contains:

- one repository checked out in the same working directory
- `tools/` for agent-usable tooling
- `secrets/` for tool configuration and credentials
- `working_knowledge/` for active and archived task state

Important directories:

- `working_knowledge/current/` -> current active truth
- `working_knowledge/archive/` -> historical snapshots only
- `working_knowledge/templates/` -> templates for knowledge files

---

## Source of Truth Rules

The agent must distinguish between:

- permanent instructions
- current workspace state
- archived historical state
- assumptions

Rules:

- `AGENTS.md` defines permanent execution rules.
- `working_knowledge/current/` contains the current active truth.
- `working_knowledge/archive/` contains historical records only.
- Archived files must never be treated as current truth by default.
- If current files conflict with archived files, current files take precedence.
- If current files conflict with repository state, repository state takes precedence.
- If a discrepancy exists between knowledge files and repository state, the agent must report it and fix the knowledge files.

---

## Working Knowledge Files

The agent must use the following files under `working_knowledge/current/`:

- `status.md` -> workspace-level current state
- `plan.md` -> active implementation plan
- `open_questions.md` -> unresolved ambiguities and blockers
- `decisions.md` -> confirmed decisions and rationale
- `handoff.md` -> concise next-session continuation point
- `repo-<name>.md` -> per-repository findings and architecture notes
- `mind_map.md` -> index of active mind map files when a mind map exists
- `mind_map/` -> concise topic-specific knowledge files for deep module, system, or domain understanding

The agent must keep these files concise, factual, and current.

### Mind Map Knowledge Files

Mind maps are optional by default and required when:

- the user explicitly asks for a mind map
- the user asks for deep understanding of a complex module, system, or domain
- the task produces cross-cutting knowledge that does not fit cleanly into a single `repo-<name>.md` file

Mind map rules:

- Mind maps live under `working_knowledge/current/`.
- `working_knowledge/current/mind_map.md` is the required top-level index when `working_knowledge/current/mind_map/` exists.
- `mind_map.md` must map every file in `working_knowledge/current/mind_map/` and describe what each file contains.
- Files under `mind_map/` should be grouped by stable topics, subsystems, workflows, or risk areas.
- Mind map files must be concise, factual, source-backed, and easy to scan.
- Mind maps complement the required template-based knowledge files; they do not replace `status.md`, `plan.md`, `open_questions.md`, `decisions.md`, `handoff.md`, or `repo-<name>.md`.
- When active mind map content becomes stale or inconsistent with repository state, the agent must update or regenerate the affected mind map files and the `mind_map.md` index.
- Archived mind maps remain historical only and must not be treated as current truth.

---

## Working Knowledge Templates

### Template Location

Templates for working knowledge files are located in:

`working_knowledge/templates/`

The agent must always use these templates when creating or regenerating
working knowledge files.

### Template Mapping

The agent must map files to templates as follows:

- `working_knowledge/current/status.md` -> `working_knowledge/templates/status.template.md`
- `working_knowledge/current/plan.md` -> `working_knowledge/templates/plan.template.md`
- `working_knowledge/current/open_questions.md` -> `working_knowledge/templates/open_questions.template.md`
- `working_knowledge/current/decisions.md` -> `working_knowledge/templates/decisions.template.md`
- `working_knowledge/current/handoff.md` -> `working_knowledge/templates/handoff.template.md`
- `working_knowledge/current/repo-<name>.md` -> `working_knowledge/templates/repo.template.md`

The agent must not invent new structures for these files.

### Template Usage Rules

When generating or updating working knowledge files, the agent must:

- start from the appropriate template
- preserve the structure of the template
- replace placeholders with actual data
- remove unused placeholder sections if irrelevant
- keep content concise and factual
- avoid adding unrelated sections

The agent must not turn these files into unstructured notes.

### Regeneration Rules

If a working knowledge file:

- becomes inconsistent with repository state
- contains stale or conflicting information
- significantly deviates from its template structure

The agent must:

1. regenerate the file using the template
2. preserve only valid and current information
3. remove outdated or redundant content

### File Size and Clarity Constraints

Working knowledge files must remain:

- concise
- structured
- easy to scan

The agent must:

- avoid long narratives
- avoid repetition
- prefer bullet points over paragraphs
- keep only information relevant to the current task

---

## Daily Session Initialization Protocol

At the beginning of a work session, before implementation begins, the agent must:

1. identify all targeted repositories for the task
2. inspect the current state of each relevant repository
3. review existing files in `working_knowledge/current/`
4. review `working_knowledge/current/mind_map.md` and `working_knowledge/current/mind_map/` when they exist and are relevant to the task
5. move previous current knowledge files into `working_knowledge/archive/<YYYY-MM-DD>/` when instructed to create a fresh daily state
6. regenerate the active current files based on present repository state
7. produce a concrete execution plan for the current task or next steps
8. generate a `session_id` for provenance notes (a stable identifier used for every commit note in this session) and record it in `status.md`

The agent must not assume previous context is still valid without checking the repositories.

The initialization step must not be skipped.

---

## Core Execution Order

The agent must always follow this order:

1. Research
2. Clarifying questions
3. Detailed planning
4. Implementation
5. Testing
6. Review
7. Commit with provenance note (per completed plan item)
8. Final validation
9. Knowledge file updates

The agent must never skip steps.

Steps 4-7 form the per-plan-item loop: each plan item is implemented,
tested, reviewed, and then committed with a provenance note before the
next item begins. Steps 8-9 run once at the end of the task.

---

## 1. Research First

Before writing code, the agent must research the existing codebase.

The research step must include:

- locating relevant files
- identifying affected modules
- identifying relevant interfaces and data structures
- identifying existing tests
- understanding architecture and conventions
- identifying integration points
- identifying risks and constraints
- tracing execution flow
- identifying entry points
- identifying downstream side effects
- identifying dependencies between components
- identifying data flow between modules
- identifying recent changes relevant to the task when possible

The agent must summarize findings before proceeding.

The agent must explain how the system works, not just list files.

The agent must not begin implementation immediately.

---

## 2. Ask Clarifying Questions

If anything is ambiguous or underspecified, the agent must ask questions
before planning.

Examples:

- unclear expected behavior
- missing input/output contract
- unclear API design
- multiple valid architectural approaches
- missing acceptance criteria
- unclear naming conventions
- unclear persistence strategy
- unclear edge case handling

If no clarification is needed, the agent must explicitly state:

`No clarification required.`

If the agent cannot proceed confidently, it must stop and ask questions.

The agent must not silently invent critical product or architecture requirements.

---

## 3. Create a Detailed Plan

After research and clarification, the agent must produce a detailed
implementation plan.

The plan must:

- use hierarchical numbering
- contain actionable steps
- be explicit enough to implement directly
- map to concrete code locations

Each plan item must include:

- objective
- exact files to modify
- functions, structs, classes, handlers, or modules affected
- expected code changes
- acceptance criteria
- required tests

A plan item without concrete implementation targets is invalid.

The agent must not implement anything before the plan is presented.

---

## 4. Implement Strictly According to the Plan

Implementation must follow the approved plan item by item.

Rules:

- implement steps in the same order as the plan
- explicitly reference the plan item being implemented
- avoid unrelated refactors
- avoid scope creep
- if new requirements appear, update the plan first

Example:

`Implementing step 1.2: Add validation logic`

---

## 5. Every Plan Item Must Have Tests

Each plan item must include tests.

A plan item is not complete without tests.

Tests must cover:

- success cases
- failure cases
- edge cases

Expected test types:

- unit tests
- integration tests when relevant
- regression tests for bug fixes

The agent must map tests to plan items.

---

## 6. Mandatory Review Step

After implementation and tests, each plan item must go through a review step.

The review must be explicit and adversarial.

Review must check for:

- correctness
- code quality
- edge cases
- regressions
- missing tests
- unnecessary complexity
- architectural consistency
- naming conventions
- performance risks
- security risks when relevant

The review must attempt to break the implementation and find issues.

If no issues are found, the agent must explicitly justify why.

---

## Review Loop Protocol

Each plan item must follow this workflow:

`implementation -> tests -> review -> commit + provenance note`

If the review finds issues:

`fix issues -> rerun tests -> review again`

This forms a review cycle.

The commit is created only after the review passes. See the
`Git Provenance Protocol` section for exact commit and note format.
A failed plan item (review still failing after 3 cycles) must NOT be
committed.

### Review Cycle Limits

A maximum of 3 review cycles per plan item is allowed.

If issues remain after the third review cycle, the agent must:

- immediately stop execution
- report failure

The failure report must include:

- which plan item failed
- what issues remain
- what fixes were attempted
- results of each review cycle

Execution must not continue after a failed review.

---

## Completion Criteria for a Plan Item

A plan item is complete only when:

- implementation is finished
- tests exist
- tests pass
- review passes with no remaining issues
- the changes are committed with a valid provenance note

---

## Git Provenance Protocol

### Purpose

Every completed plan item must leave a durable, machine-checkable record of
what changed and why, anchored to the exact commit. This makes the whole
branch auditable afterward by a fresh session, and forms the basis for later
tooling. The record has two parts: the commit (the diff) and a git note (the
rationale plus plan linkage).

### Granularity and Timing

- Exactly one commit per completed plan item. One plan step = one commit.
- Do not batch multiple plan items into a single commit.
- Do not commit an incomplete or failed plan item.
- The commit is created only after the item satisfies the Completion
  Criteria (implemented, tests exist, tests pass, review passes).
- Order per item: commit first, then attach the note, then update working
  knowledge files.

### Commit

- Stage only the changes belonging to the current plan item.
- The commit message is human-readable and references the plan item:

  `step <plan_step_id>: <short imperative summary>`

  Example: `step 1.2: add auth input validation`

- Keep the commit message clean and human-readable. Structured provenance
  does NOT go in the message; it goes in the git note.

### Provenance Note

Immediately after the commit, attach a single JSON object as a git note under
the dedicated `provenance` ref:

```
git notes --ref=provenance add -m '<json>' HEAD
```

Read it back to verify:

```
git notes --ref=provenance show HEAD
```

Required fields:

```json
{
  "schema_version": 1,
  "plan_step_id": "1.2",
  "plan_revision": "<hash of plan.md at commit time>",
  "rationale": "<what this change does and why, in the agent's own words>",
  "actor": "driver",
  "model": "<the agent/model running this session, e.g. codex>",
  "session_id": "<the id generated at session start>",
  "ts": "<ISO-8601 UTC timestamp>"
}
```

Optional fields (include only when meaningful):

```json
{
  "severity": 3,
  "tool": "edit",
  "parent_step_id": "1",
  "request_id": "<only once an LLM proxy exists; omit otherwise>"
}
```

### Field Rules

- `schema_version` — always `1` for now. Present so the schema can evolve
  later without ambiguity.
- `plan_step_id` — the hierarchical id of the completed item (`1`, `1.1`,
  `1.2`). Enables the step-vs-plan check.
- `plan_revision` — the plan mutates during a task, so the note must anchor to
  the plan as it was when the item was implemented. Use the content hash of
  the plan file: `git hash-object working_knowledge/current/plan.md`. Without
  this, step-vs-plan comparison becomes meaningless once the plan changes.
- `rationale` — the agent's own explanation of the change. In this phase it is
  self-reported, so keep it specific and honest, not self-congratulatory. It
  will later be checked against the diff, so it must actually describe the diff.
- `actor` — who originated the change: `driver` (this agent), `human`, or
  `advisor:<n>` (a separate advisor/review session). Default `driver`.
- `model` — the identifier of the agent/model running the session. This is the
  variable under comparison when evaluating different agents; never omit it.
- `session_id` — the id generated during session initialization; reuse the same
  value for every note in the session.
- `ts` — ISO-8601 UTC timestamp.
- `severity` (optional) — self-assessed blast radius / sensitivity of the
  touched code, 0-10. Self-scored in this phase, so it is a hint only, not an
  enforced gate.
- `request_id` (optional) — correlation to a specific LLM turn. Only meaningful
  once an LLM proxy exists; omit until then.

### Rules

- One note per commit; one commit per completed plan item.
- Never rewrite a commit to change its provenance. Notes are edited separately
  (`git notes --ref=provenance edit HEAD`) so the commit sha, which is the
  anchor everything points to, never changes.
- Never put the provenance JSON in the commit message.
- Always pass `--ref=provenance`; do not write to the default notes ref.
- If a valid note cannot be produced for any reason, stop and report rather
  than committing without one.

### Reviewing a Branch Afterward

A fresh session (never the implementing session) can audit the whole branch:

```
git log --format='%H %s' --notes=provenance
git notes --ref=provenance show <sha>
```

For each commit this enables three independent checks:

- diff vs rationale — does the code match what the note claims (reconstruct
  intent from the diff alone first, then compare)
- step vs plan — did the item do what its plan step required, without scope creep
- diff vs plan — do the changes objectively satisfy the step, ignoring the narrative

A self-review by the implementing session does not count; it shares the blind
spots that produced the code.

---

## Assumptions Protocol

The agent must explicitly list assumptions made during:

- research
- planning
- implementation
- review

If assumptions are critical, the agent must validate them or raise them as clarifying questions.

The agent must never hide important assumptions.

---

## Multi-Repository Rules

If the workspace contains multiple repositories, the agent must:

- identify which repositories are relevant to the current task
- produce per-repository findings
- identify cross-repository dependencies
- avoid mixing responsibilities between repositories without justification
- map each plan item to one or more specific repositories

Cross-repository changes must be described explicitly.

---

## Knowledge File Update Rules

After session initialization and after each meaningful implementation iteration, the agent must update the files in `working_knowledge/current/`.

Required updates:

- `status.md` -> current state of work
- `plan.md` -> progress by plan item
- `open_questions.md` -> unresolved blockers or ambiguities
- `decisions.md` -> confirmed decisions
- `handoff.md` -> exact next step
- `repo-<name>.md` -> important repo-specific discoveries if changed
- `mind_map.md` and `mind_map/` -> active deep-knowledge map and topic notes if a mind map exists or the task requires one

Updates must be factual and concise.

The agent must not let working knowledge drift from repository reality.

---

## Final Validation

Before finishing the task, the agent must verify:

- all plan items were implemented
- all plan items have tests
- all tests pass
- all plan items passed review
- each completed plan item has exactly one commit
- each of those commits has a valid provenance note under `refs/notes/provenance`
- code compiles
- integration works
- working knowledge files were updated
- active mind map files were updated when the task changed mapped knowledge

The agent must then produce a summary.

---

## Required Agent Output Structure

Every task response must follow this structure:

### A. Research Summary
- relevant files
- current behavior
- architecture notes
- constraints
- risks

### B. Clarifying Questions
Questions must be asked if anything is unclear.

If not needed, the agent must explicitly state:

`No clarification required.`

### C. Detailed Plan
The plan must use hierarchical numbering:
`1`, `1.1`, `1.2`, `2`, `2.1`, `2.2`

### D. Implementation Progress
Each implementation step must reference the plan item.
For each completed item, report the commit sha and the provenance note JSON.

### E. Test Coverage
Tests must be mapped to plan items.

### F. Review Status
Each plan item must report review results.

### G. Knowledge File Updates
The agent must report which working knowledge files were updated.

### H. Final Summary
The final summary must include:
- completed plan items
- files modified
- tests added
- tests executed
- review results
- commits created, each with its plan_step_id and provenance note
- assumptions
- follow-ups

---

## Non-Negotiable Rules

- Research always comes first.
- The agent must ask questions if anything is unclear.
- A detailed plan must exist before implementation.
- Implementation must follow the plan.
- Every plan item must have tests.
- Every plan item must pass review.
- Each item has a maximum of 3 review cycles.
- If review still fails after 3 cycles, execution must stop.
- Every completed plan item must produce exactly one commit.
- Every such commit must carry a valid provenance note under `refs/notes/provenance`.
- Provenance goes in the note, never in the commit message; commits are never rewritten to alter provenance.
- A failed plan item must not be committed.
- The agent must keep working knowledge files updated.
- Archived knowledge must not be treated as current truth.
- A task is not complete until implementation, tests, review, commits with notes, and knowledge updates are finished.

---

## Short Operational Prompt

Use this instruction when assigning work to the agent:

First perform research on the existing codebase and summarize findings.

Inspect the current repository state and refresh the files in
`working_knowledge/current/`.

If anything is unclear, ask clarifying questions before proceeding.

Then create a detailed implementation plan using hierarchical numbering
(`1`, `1.1`, `1.2`, `2`, `2.1`...).

Each plan item must identify exact files, impacted code units, acceptance
criteria, and required tests.

After that, implement strictly according to the plan item by item.

Every plan item must include tests.

After implementation and tests, perform an explicit adversarial review for
that item. If the review finds issues, fix them and review again.

Repeat this review/fix cycle up to 3 times maximum.

If an item still has unresolved issues after the third review cycle,
stop execution and report failure.

Once an item passes review, create exactly one commit for it
(`step <plan_step_id>: <summary>`) and attach a provenance note with
`git notes --ref=provenance add`, containing schema_version, plan_step_id,
plan_revision, rationale, actor, model, session_id, and ts. Provenance goes
in the note, not in the commit message.

After each meaningful iteration, update the files in
`working_knowledge/current/`.

Do not mark the task complete until all implementation items, tests,
reviews, and knowledge updates are finished and validated.