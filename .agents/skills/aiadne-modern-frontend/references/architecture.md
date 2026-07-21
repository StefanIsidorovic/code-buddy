# AIadne frontend architecture

## Dependency direction

```text
App composition
  -> feature panels/dialogs + feature hooks
  -> shared UI / presentation helpers / domain types
  -> tauriGateway
  -> Tauri backend
```

- Presentation components receive typed values and callbacks; they do not invoke backend commands.
- Feature hooks coordinate effects and commands for one domain. They expose intentional state/actions, not raw setters by default.
- Shared UI has no feature knowledge. Shared domain types have no React knowledge.
- Infrastructure may depend on framework libraries; feature presentation may not depend on infrastructure internals.

## State placement

| State kind | Owner |
| --- | --- |
| Input open/closed/focus state used by one component | Local component |
| Feature form and async workflow state | Feature hook |
| Backend-persisted entities | Feature hook/cache refreshed through gateway |
| Cross-feature notification state | Small Zustand store |
| Value derivable from current props/state | Compute; do not store |
| Imperative terminal/process object | Dedicated runtime hook/ref |

Use Zustand when at least two independent branches need the same client-owned state or prop drilling crosses several unrelated layers. Keep store actions semantic and selectors narrow. Never use a store as a service locator.

## React and TypeScript patterns

- Model UI variants with discriminated unions when combinations can be invalid.
- Use explicit prop interfaces and callback payloads. Avoid boolean clusters when a named state communicates policy better.
- Keep effects for synchronization with external systems. Event-triggered work belongs in event handlers/actions.
- Abort, version, or identity-check async requests whose results can arrive after selection changes.
- Keep callback dependencies honest. Use current-value refs only for long-lived external subscriptions that must not remount.
- Prefer immutable updates and pure helpers for transformations with meaningful branching.
- Surface errors as `unknown`, convert them through the shared error formatter, and retain actionable context.

## Testing standard

- Test through accessible roles/names and visible behavior.
- Cover success plus the most important empty, loading, locked, error, and stale-response path.
- Test callback payloads and policy boundaries in extracted presentation components.
- Mock the gateway/framework boundary, not internal helper implementation.
- Add focused unit tests for pure transformations and integration tests for orchestration.
- Avoid brittle DOM traversal and duplicate-text selectors; scope queries with roles, names, or `within`.

## Review checklist

- Is responsibility in the narrowest correct layer?
- Did App gain feature logic or direct infrastructure access?
- Is state duplicated or globally stored without independent consumers?
- Can an old async response overwrite a newer selection?
- Are backend command names/payloads preserved and typed?
- Are disabled/loading/error semantics and accessible names correct?
- Are tests capable of failing for the regression being prevented?
- Did file size or coupling increase enough to justify another extraction?
