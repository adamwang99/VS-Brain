# VS Brain — Provider Certification Dossier: Claude

State: `candidate`
Date: 2026-05-27 18:16 GMT+7
Owner: Adam / Phương
Provider key: `claude`
Production loop allowed now: `no`

## Scope

This dossier applies the contract in:
`docs/PROVIDER_CERTIFICATION_CONTRACT.md`

Current purpose:
- prepare Claude as the first post-baseline provider candidate
- define pass/fail checklist before any runtime enablement
- prevent premature addition into `CERTIFIED_PROVIDERS`

## Current known status

- Host mapping already anticipated in code path: `claude.ai`
- Claude is **not** production-certified
- Claude is **not** allowed into production auto-loop
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
- Planned host: `claude.ai`
- Current status: host path is anticipated conceptually, but Claude is not active in production gate
- Needed evidence:
  - live Claude tab URL example
  - mapping verification log

### Gate 2 — Latest response extraction
- Current status: no Claude-certified selector set in current hardened runtime
- Needed evidence:
  - candidate selector list for latest assistant response
  - sample extracted text
  - false-positive check against user turns

### Gate 3 — Prompt fill
- Current status: no Claude-certified composer path
- Needed evidence:
  - input selector path
  - fill method result (`setValue` / clipboard)
  - retry behavior note

### Gate 4 — Send action
- Current status: no Claude-certified send path
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
  - finalize prompt sent on Claude
  - readback of final answer
  - final `.md` export success

### Gate 8 — Drift safety
- Current status: not validated
- Needed evidence:
  - selector break behavior note
  - wrong-tab / refresh / missing-tab behavior note
  - suspension trigger note

## Risks

- Claude DOM/UI may differ materially from ChatGPT/Gemini assumptions
- Composer/send semantics may drift more often than host mapping suggests
- Adding Claude too early could create false confidence because host detection alone is not sufficient
- Finalize flow may fail even if normal relay works

## Minimum live validation plan

Run after current 2-provider baseline is accepted.

1. open Claude tab and verify provider recognition
2. verify latest response extraction on long reply
3. verify prompt fill into Claude composer
4. verify send action
5. verify new response detection
6. verify relay in one pairwise run involving Claude
7. verify stop phrase positive/negative cases
8. verify max-step draft finalize case
9. verify manual stop case
10. verify tab refresh / drift safety

## Decision

- allowed_in_production_loop: `no`
- certification_state: `candidate`
- next_action: `collect live evidence gate-by-gate after ChatGPT/Gemini baseline test pass`

## Enablement rule

Claude may be moved into `CERTIFIED_PROVIDERS` only when:
1. this dossier is updated with real evidence
2. all 8 gates are PASS
3. owner accepts loop stability impact
4. current certified baseline remains stable after Claude enablement
