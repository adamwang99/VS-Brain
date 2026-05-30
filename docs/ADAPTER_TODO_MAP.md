# VS Brain — Adapter TODO Map

Saved: 2026-05-27 18:25 GMT+7
Purpose: concise engineering map of what each provider still lacks before certification

## Baseline providers

### chatgpt
- Status: `certified-baseline`
- Current runtime: enabled
- Remaining work:
  - collect deferred live test evidence
  - confirm adapter seam refactor did not regress live behavior
  - record drift notes if any appear during owner test

### gemini
- Status: `certified-baseline`
- Current runtime: enabled
- Remaining work:
  - collect deferred live test evidence
  - confirm adapter seam refactor did not regress live behavior
  - record drift notes if any appear during owner test

## Candidate providers

### claude
- Status: `candidate`
- Missing now:
  - certified latest-response selector
  - certified input selector
  - certified send selector
  - new-response detection evidence
  - stop-phrase validation
  - finalize compatibility evidence
  - drift safety note
- Source dossier: `docs/providers/claude-certification.md`

### deepseek
- Status: `candidate`
- Missing now:
  - certified latest-response selector
  - certified input selector
  - certified send selector
  - new-response detection evidence
  - stop-phrase validation
  - finalize compatibility evidence
  - drift safety note
- Source dossier: `docs/providers/deepseek-certification.md`

### perplexity
- Status: `candidate`
- Missing now:
  - certified latest-response selector
  - certified input selector
  - certified send selector
  - new-response detection evidence
  - stop-phrase validation
  - finalize compatibility evidence
  - drift safety note
  - answer/citation boundary note
- Source dossier: `docs/providers/perplexity-certification.md`

### grok
- Status: `candidate`
- Missing now:
  - certified host-path behavior (`grok.com` vs `x.com/i/grok`)
  - certified latest-response selector
  - certified input selector
  - certified send selector
  - new-response detection evidence
  - stop-phrase validation
  - finalize compatibility evidence
  - drift safety note
- Source dossier: `docs/providers/grok-certification.md`

## Engineering rule

Do not promote any TODO item to "done" based on code guesswork alone.
Every closure must be backed by live evidence and reflected back into the provider dossier.

## Related docs

- `docs/PROVIDER_INDEX.md`
- `docs/PROVIDER_CERTIFICATION_CONTRACT.md`
- `docs/TEST_DEBT_2PROVIDER_HARDENING.md`
