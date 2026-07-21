---
name: aiadne-modern-frontend
description: Enforce AIadne's modern React 19 and TypeScript frontend architecture. Use for every implementation, refactor, review, or bug fix touching src/**/*.ts, src/**/*.tsx, frontend tests, state management, Tauri calls, xterm integration, accessibility, or frontend build configuration.
---

# AIadne Modern Frontend

Build frontend changes that are typed, feature-oriented, accessible, testable, and small enough to maintain.

## Workflow

1. Read `AGENTS.md` and current working knowledge before editing.
2. Inspect the affected feature, its nearest test, domain types, and integration boundary.
3. Read [references/architecture.md](references/architecture.md). Apply only relevant sections, but never skip its dependency rules.
4. State the ownership boundary before implementation: presentation, feature orchestration, shared domain, or infrastructure.
5. Prefer the smallest local change that improves rather than weakens that boundary.
6. Add or update behavior-focused tests alongside the changed feature.
7. Run `npm run frontend:audit`, `npm run typecheck`, `npm run test -- --run`, and `npm run build`.
8. Review the diff for hidden coupling, duplicated derived state, stale async results, accessibility regressions, unsafe escape hatches, and accidental scope growth.

## Non-negotiable rules

- Keep `App.tsx` a composition root. Do not add feature JSX, backend workflows, protocol parsing, or new domain-owned form state there.
- Put feature UI and hooks under `src/features/<domain>/`; colocate tests.
- Keep components state-free when state belongs to an orchestrating hook. Keep transient local interaction state local.
- Use Zustand only for genuinely shared client state with multiple independent consumers. Do not move server/backend state into a global store merely to shorten props.
- Use `src/lib/tauriGateway.ts` for backend commands. Never import Tauri core outside that gateway or tests.
- Keep xterm lifecycle inside `src/features/runtime/usePtyTerminal.ts` or a successor runtime hook.
- Reuse `src/types/domain.ts` contracts. Do not duplicate backend/domain shapes in components.
- Derive values during render or with `useMemo`; do not mirror derivable values in effects/state.
- Guard asynchronous refreshes against stale responses when selection or identity can change in flight.
- Reject `any`, `@ts-ignore`, non-null assertions used to silence design problems, and broad type casts. Narrow unknown data explicitly.
- Preserve semantic HTML, labels, keyboard behavior, focus behavior, loading/empty/error states, and action locks.
- Do not introduce a new dependency when platform APIs or current dependencies solve the problem clearly. Explain any necessary dependency.
- Do not declare success from snapshots or typecheck alone; verify observable behavior.

## Size policy

- New feature components: target under 150 lines; hard ceiling 250.
- New hooks/modules: target under 150 lines; hard ceiling 250 unless the file is a domain contract.
- Do not increase `App.tsx` above its checked ceiling. Prefer reducing it whenever touched.
- Split by responsibility, not arbitrary line ranges. Avoid barrel files until they remove real import noise.

## Completion report

Report the ownership boundary chosen, tests added, all verification results, and any remaining architectural debt. Treat a failing audit as unfinished work unless the failure predates the change and is explicitly documented.
