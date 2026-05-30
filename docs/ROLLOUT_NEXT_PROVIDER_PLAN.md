# VS Brain — Rollout Next Provider Plan

Saved: 2026-05-27 18:42 GMT+7
Purpose: define the exact sequence after baseline acceptance

## Hard rule

Only one new provider may be advanced per wave.
Do not open multiple provider enablements in parallel.

## Recommended order

1. `claude`
2. `deepseek`
3. `perplexity`
4. `grok`

## Sequence per provider

### Step 1 — choose provider
- confirm baseline already accepted
- pick exactly one provider dossier

### Step 2 — collect evidence
- use `docs/PROVIDER_EVIDENCE_TEMPLATE.md`
- attach screenshots/logs
- update provider dossier with real results

### Step 3 — certification decision
- compare evidence against `docs/PROVIDER_CERTIFICATION_CONTRACT.md`
- if all 8 gates PASS → provider may be marked `certified`
- if not → keep `candidate` or move to `experimental` / `suspended`

### Step 4 — controlled enablement
- add provider to production gate only after explicit acceptance
- run regression check against existing certified baseline

### Step 5 — post-enable observation
- verify no baseline regression on ChatGPT/Gemini
- verify new provider does not destabilize finalize/stop/drift behavior

## Abort conditions

Stop rollout immediately if:
- wrong-tab behavior appears
- latest-response extraction is stale/wrong
- send action is unreliable
- finalize/export breaks
- drift becomes silent rather than explicit

## Expected artifact trail

- provider dossier
- provider evidence record
- decision note
- regression note
