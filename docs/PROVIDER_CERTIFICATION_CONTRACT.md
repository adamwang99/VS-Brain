# VS Brain — Provider Certification Contract

Version: `v1`
Saved: 2026-05-27 18:05 GMT+7
Status: active design contract
Scope: governs when a provider is allowed to join VS Brain production loop runtime

## Purpose

This contract exists to prevent premature multi-provider rollout.
A provider must be **certified** before it can participate in the production critique loop.

This preserves 3 things:
- loop stability
- predictable DOM/runtime behavior
- controlled expansion from `ChatGPT + Gemini` to additional providers

## Core rule

A provider is allowed into production loop runtime only if **all certification gates pass**.

Until then, a provider may exist in:
- roadmap
- experimental code
- hidden adapter draft
- docs/spec

But it must **not** join the production auto-loop.

## Runtime states

Each provider must have one explicit state:

- `draft` → idea/spec exists only
- `experimental` → adapter exists but not trusted
- `candidate` → adapter works partially, needs checklist
- `certified` → passed required gates, allowed in production loop
- `suspended` → was certified before, now blocked due to drift/regression
- `retired` → intentionally removed from support path

## Current certified baseline

Production-certified now:
- `chatgpt`
- `gemini`

Not yet production-certified:
- `claude`
- `deepseek`
- `perplexity`
- `grok`

## Required certification gates

A provider must pass all gates below.

### Gate 1 — Provider identity
Must detect provider reliably from URL/host.

Pass criteria:
- host mapping is stable
- no ambiguous routing to wrong provider label
- runtime can reject unsupported host safely

Evidence:
- host examples
- mapping snippet
- result log

### Gate 2 — Latest response extraction
Must read the latest assistant/model response correctly.

Pass criteria:
- latest visible response is captured
- no stale response chosen
- no user message mistaken as provider response
- extraction works on long replies

Evidence:
- DOM selector list
- sample extracted text
- screenshot or live verification note

### Gate 3 — Prompt fill
Must fill the provider input reliably.

Pass criteria:
- works with provider textbox/composer
- no partial paste/corrupt content
- survives at least one retry path
- no silent write to wrong field

Evidence:
- selector path used
- method used (`setValue` / clipboard / other)
- success log

### Gate 4 — Send action
Must trigger send reliably.

Pass criteria:
- correct button/action found
- no false positive click on unrelated button
- disabled state respected
- send path works in real tab

Evidence:
- selector path
- send keywords if used
- success/failure log

### Gate 5 — New response detection
Must detect that a new provider response arrived.

Pass criteria:
- hash/content change detected correctly
- no false positive from streaming shell/UI repaint
- timeout path behaves safely

Evidence:
- wait log
- content hash change example
- timeout example if applicable

### Gate 6 — Stop phrase semantics
Must not break agreement-stop logic.

Pass criteria:
- stop phrase checked only against latest response final line
- no false stop from quoted/earlier text
- provider formatting does not corrupt stop detection

Evidence:
- positive example
- negative example

### Gate 7 — Finalize compatibility
Must work with final blueprint/spec generation flow.

Pass criteria:
- final prompt can be filled and sent
- final response can be read back
- final Markdown export succeeds
- fallback behavior understood if readback fails

Evidence:
- finalize log
- downloaded file name example

### Gate 8 — Drift safety
Must fail safely when provider UI drifts.

Pass criteria:
- selector break produces visible failure, not silent corruption
- wrong-tab / missing-tab / changed-tab behavior is safe
- provider can be suspended without redesigning core loop

Evidence:
- failure-mode note
- suspension trigger note

## Minimum live test matrix

Every provider candidate must be tested on these scenarios:

1. open tab recognized
2. latest response extracted
3. relay fill into provider
4. send action works
5. wait for new response works
6. loop continues correctly
7. stop phrase positive case
8. max-step / draft finalize case
9. manual stop case
10. tab refresh / drift case

## Certification decision template

Use this exact template for each provider:

```md
## Provider: <name>
State: draft | experimental | candidate | certified | suspended | retired
Date:
Owner:

### Gate results
- Gate 1 — Provider identity: PASS | FAIL | PARTIAL
- Gate 2 — Latest response extraction: PASS | FAIL | PARTIAL
- Gate 3 — Prompt fill: PASS | FAIL | PARTIAL
- Gate 4 — Send action: PASS | FAIL | PARTIAL
- Gate 5 — New response detection: PASS | FAIL | PARTIAL
- Gate 6 — Stop phrase semantics: PASS | FAIL | PARTIAL
- Gate 7 — Finalize compatibility: PASS | FAIL | PARTIAL
- Gate 8 — Drift safety: PASS | FAIL | PARTIAL

### Evidence
- 

### Risks
- 

### Decision
- allowed_in_production_loop: yes | no
- certification_state: <state>
- next_action: <text>
```

## Hard production rule

A provider may be added to `CERTIFIED_PROVIDERS` only when:
1. contract checklist is completed
2. live validation evidence exists
3. decision says `allowed_in_production_loop: yes`
4. current certified baseline still remains stable after enabling it

## Suspension rule

A certified provider must move to `suspended` if:
- selector drift causes loop break
- send action becomes unreliable
- extraction becomes stale/incorrect
- finalize flow breaks
- repeated owner test shows regression

When suspended:
- remove from production loop gate
- keep docs/history
- do not delete lessons/evidence

## Expansion sequence recommendation

Recommended order after current baseline stabilizes:
1. `claude`
2. `deepseek`
3. `perplexity`
4. `grok`

Only one new provider should be certified at a time.
Do not certify multiple new providers in one wave.

## Relationship to current 2-provider hardening

The current `ChatGPT + Gemini` restriction is not a permanent product limitation.
It is a temporary certification gate.
This document defines the path to expand safely.
