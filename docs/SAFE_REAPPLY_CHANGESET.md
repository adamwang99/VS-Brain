# VS Brain — Safe Re-apply Changeset

Saved: 2026-05-27 22:29 GMT+7
Purpose: list changes that are likely safe to re-apply gradually after rollback-good baseline is validated

## Rule

Only re-apply one cluster at a time.
Test after every cluster.
Do not merge all previous refactor/runtime hardening changes in one wave again.

## Cluster A — Manifest permissions
Status: already kept

Included:
- wildcard host permissions for ChatGPT/OpenAI/Gemini variants

Risk:
- low

## Cluster B — Visual/UI-only improvements
Status: candidate for later re-apply

Included:
- font normalization
- dropdown truncation / ellipsis
- right-edge overflow fixes
- compact button layout

Risk:
- low to medium

Rule:
- re-apply without touching scan/pick/start runtime logic

## Cluster C — Archive panel UX improvements
Status: candidate for later re-apply

Included:
- simplified archive actions
- bundle export button
- advanced archive section grouping

Risk:
- low to medium

Rule:
- must not change startup/runtime path

## Cluster D — Finalize/export flow changes
Status: hold

Included:
- auto-finalize after non-manual stop
- markdown-only export default
- finalize fallback readback
- hidden Save button

Risk:
- high

Rule:
- do not re-apply before baseline test pass
- re-apply in isolation only

## Cluster E — Runtime tab/pair selection changes
Status: hold

Included:
- certified-provider gating inside runtime flow
- manual pair preservation logic
- refreshTabs / chooseSourceAndTarget refactor
- hard reset runtime behavior
- popup/provider registry split dependencies

Risk:
- very high

Rule:
- treat as regression-prone
- re-apply only after separate evidence-backed test design

## Cluster F — Adapter/runtime architecture changes
Status: hold

Included:
- popup-level provider registry runtime dependency
- in-page adapter seam refactor
- certified gate integration into baseline runtime

Risk:
- very high

Rule:
- should return later as controlled architecture phase, not quick patch

## Recommended re-apply order

1. Cluster B — Visual/UI-only improvements
2. Cluster C — Archive panel UX improvements
3. baseline re-test
4. Cluster D — Finalize/export flow changes
5. baseline re-test
6. Cluster E/F only in separate controlled phase
