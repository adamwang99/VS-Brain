# VS Brain — Provider Certification Dossier: Perplexity

State: `candidate`
Date: 2026-05-27 18:21 GMT+7
Owner: Adam / Phương
Provider key: `perplexity`
Production loop allowed now: `no`

## Scope

This dossier applies the contract in:
`docs/PROVIDER_CERTIFICATION_CONTRACT.md`

Current purpose:
- prepare Perplexity as a post-baseline provider candidate
- define pass/fail checklist before any runtime enablement
- prevent premature addition into `CERTIFIED_PROVIDERS`

## Current known status

- Host mapping already anticipated in code path: `perplexity.ai`
- Perplexity is **not** production-certified
- Perplexity is **not** allowed into production auto-loop
- No live validation evidence recorded yet in this dossier

## Gate results

- Gate 1 — Provider identity: `PARTIAL`
- Gate 2 — Latest response extraction: `PARTIAL`
- Gate 3 — Prompt fill: `PARTIAL`
- Gate 4 — Send action: `PARTIAL`
- Gate 5 — New response detection: `FAIL`
- Gate 6 — Stop phrase semantics: `FAIL`
- Gate 7 — Finalize compatibility: `FAIL`
- Gate 8 — Drift safety: `FAIL`

## Evidence

### Gate 1 — Provider identity
- Planned host: `perplexity.ai`
- Current status: host path is anticipated conceptually, but Perplexity is not active in production gate
- Needed evidence:
  - live Perplexity tab URL example
  - mapping verification log

### Gate 2 — Latest response extraction
- Current status: no Perplexity-certified selector set in current hardened runtime
- Needed evidence:
  - candidate selector list for latest assistant response
  - sample extracted text
  - false-positive check against user turns

### Gate 3 — Prompt fill
- Current status: no Perplexity-certified composer path
- Needed evidence:
  - input selector path
  - fill method result (`setValue` / clipboard)
  - retry behavior note

### Gate 4 — Send action
- Current status: no Perplexity-certified send path
- Needed evidence:
  - send selector path
  - live click success log
  - negative control against unrelated buttons

### Gate 5 — New response detection
- Current status: not validated
- Needed evidence:
  - new response hash change example
  - timeout behavior note

### Gate 6 — Stop phrase semantics
- Current status: not validated
- Needed evidence:
  - positive case where final line equals stop phrase
  - negative case where stop phrase appears earlier/quoted only

### Gate 7 — Finalize compatibility
- Current status: not validated
- Needed evidence:
  - finalize prompt sent on Perplexity
  - readback of final answer
  - final `.md` export success

### Gate 8 — Drift safety
- Current status: not validated
- Needed evidence:
  - selector break behavior note
  - wrong-tab / refresh / missing-tab behavior note
  - suspension trigger note

## Risks

- Perplexity result layout may mix citations/answer blocks in ways that confuse latest-response extraction
- Composer/send semantics may differ from baseline providers
- Finalize flow may fail even if simple relay looks usable
- Premature enablement could introduce noisy false positives in stop detection

## Minimum live validation plan

Run after current 2-provider baseline is accepted.

1. open Perplexity tab and verify provider recognition
2. verify latest response extraction on long reply
3. verify prompt fill into Perplexity composer
4. verify send action
5. verify new response detection
6. verify relay in one pairwise run involving Perplexity
7. verify stop phrase positive/negative cases
8. verify max-step draft finalize case
9. verify manual stop case
10. verify tab refresh / drift safety

## Decision

- allowed_in_production_loop: `no`
- certification_state: `candidate`
- next_action: `collect live evidence gate-by-gate after ChatGPT/Gemini baseline test pass`

## Enablement rule

Perplexity may be moved into `CERTIFIED_PROVIDERS` only when:
1. this dossier is updated with real evidence
2. all 8 gates are PASS
3. owner accepts loop stability impact
4. current certified baseline remains stable after Perplexity enablement
