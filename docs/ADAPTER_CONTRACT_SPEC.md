# VS Brain — Adapter Contract Spec

Saved: 2026-05-27 18:45 GMT+7
Status: active engineering spec
Purpose: define the minimum contract for provider adapters before deeper multi-provider expansion

## Why this spec exists

VS Brain now has:
- popup-level provider registry
- self-contained in-page adapter registry
- certified provider gate

To expand safely, each provider adapter must follow one consistent contract.
This avoids ad-hoc selector sprawl and keeps the core loop stable.

## Design goals

- simple adapter shape
- explicit capabilities
- runtime-safe for `chrome.scripting.executeScript`
- easy to certify provider-by-provider
- easy to suspend without changing core loop

## Adapter contract

Each provider adapter should expose a data contract with these fields:

```js
{
  name: 'chatgpt',
  hostPatterns: ['chatgpt.com', 'chat.openai.com'],
  readSelectors: [],
  inputSelectors: [],
  sendSelectors: [],
  sendKeywords: [],
  capabilities: {
    latestResponseRead: true,
    promptFill: true,
    sendAction: true,
    finalizeCompatible: true,
    stopPhraseCompatible: true,
    handoffCompatible: true
  },
  notes: {
    knownRisks: [],
    driftSignals: []
  }
}
```

## Required fields

### `name`
- provider key used by runtime
- examples: `chatgpt`, `gemini`, `claude`

### `hostPatterns`
- list of host/url identifiers used for provider detection
- must be specific enough to avoid misrouting

### `readSelectors`
- ordered selector list for latest provider response extraction
- selectors should prefer newest stable response container first

### `inputSelectors`
- ordered selector list for prompt/composer fill path
- should include retry-friendly alternatives

### `sendSelectors`
- ordered selector list for send/submit action
- should avoid broad false-positive clicks when possible

### `sendKeywords`
- fallback keyword filter for ambiguous send buttons
- examples: `send`, `gửi`, `submit`

### `capabilities`
Boolean flags indicating what the adapter is trusted to do.

Minimum flags:
- `latestResponseRead`
- `promptFill`
- `sendAction`
- `finalizeCompatible`
- `stopPhraseCompatible`
- `handoffCompatible`

### `notes`
Engineering notes that should not change runtime behavior directly.

Fields:
- `knownRisks`
- `driftSignals`

## Minimum runtime expectations

An adapter is considered production-usable only if:
- `latestResponseRead = true`
- `promptFill = true`
- `sendAction = true`
- `finalizeCompatible = true`
- `stopPhraseCompatible = true`

If any required capability is false:
- provider must not enter `CERTIFIED_PROVIDERS`
- provider may remain `draft`, `experimental`, or `candidate`

## Separation of concerns

### Popup-level registry
Responsible for:
- host mapping
- certified-provider gating
- provider label formatting
- runtime list filtering

### In-page adapter registry
Responsible for:
- read selector list
- input selector list
- send selector list
- send keyword matching
- provider-local DOM behavior

### Certification artifacts
Responsible for:
- trust decision
- evidence trail
- suspension history
- rollout decision

## Evolution path

### Current phase
- adapters may remain inline/self-contained for runtime safety

### Next phase
- normalize adapter objects to this contract shape everywhere

### Later phase
- split per-provider adapter payloads into dedicated files or generated artifacts if runtime constraints allow

## Suspension compatibility

Every adapter must be removable from production loop by gate only.
Core loop should not need structural rewrite just to suspend a provider.

## Recommended validation before enabling a new provider

1. provider dossier exists
2. evidence record exists
3. contract fields filled meaningfully
4. all required capabilities proven true
5. certification contract passes
6. baseline regression check passes

## Non-goals

This spec does not define:
- pricing/plan gating
- cloud sync
- provider auth/session handling
- OCR/browser automation outside current extension runtime

## Related docs

- `docs/PROVIDER_CERTIFICATION_CONTRACT.md`
- `docs/PROVIDER_INDEX.md`
- `docs/ADAPTER_TODO_MAP.md`
- `docs/PROVIDER_EVIDENCE_TEMPLATE.md`
- `docs/ROLLOUT_NEXT_PROVIDER_PLAN.md`
