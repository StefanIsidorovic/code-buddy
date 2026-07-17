# Open Questions

## Blocking
- None.

## Non-Blocking
- Should generated Knowledge Unit context be opt-in per prompt, sticky per ACP session, or both?
- Should continue-from-transcript use selected raw turns, a generated summary, or a bounded combination?
- Should manual Knowledge Cards later migrate into the Knowledge Unit schema or remain a separate user-authored layer?
- When should the internal package/crate name and `com.codebuddy.app` identifier migrate from Code Buddy to AIadne?

## Resolved
- Should embeddings precede deterministic selection?: No; the explainable baseline is implemented first.
- Should generated units immediately replace manual prompt injection?: No; preview and explicit user control come first.
- Should repository/path scope be inferred from prose?: No; only persisted evidence relationships may establish scope.
- Should the selector rewrite Knowledge Unit content?: No; it selects and orders immutable units while preserving provenance.
