# VS Brain — Rollback-Good Runtime Note

Saved: 2026-05-27 22:29 GMT+7
Status: active runtime note

## Meaning

Current runtime that successfully runs again is the rollback baseline restored from:
- `apps/extension/popup.js.bak-20260527-1550`
- `apps/extension/popup.html.bak-20260527-1550`
- `apps/extension/popup.css.bak-20260527-1550`

This runtime should be treated as the current known-good execution baseline until further controlled re-apply work is tested incrementally.

## Important distinction

- Runtime/UI state currently executing = rollback-good baseline
- Docs/spec/artifact layer = newer and still valid
- Snapshot of the regressed refactor state has been preserved separately for later selective recovery

Snapshot path:
`projects/crosscritic/memory_snapshots/v0.8.17-runtime-regression-20260527-221837/`

## Hard rule

Do not re-introduce the refactor/runtime-hardening wave as one bulk patch.
Re-apply only in small isolated batches after baseline validation.

## What remains kept even after rollback

- expanded manifest host permissions
- docs/spec artifacts
- provider contract/dossiers/index/todo map
- release note / owner test forms / settings spec / rollout scaffolding

## Next safe path

1. test rollback-good baseline
2. identify one safe UI/runtime change cluster
3. re-apply one cluster only
4. test again
