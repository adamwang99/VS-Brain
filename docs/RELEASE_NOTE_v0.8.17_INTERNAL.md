# VS Brain — Internal Release Note v0.8.17

Saved: 2026-05-27 18:29 GMT+7
Scope: internal hardening wave before owner live validation

## What changed

### UI / UX
- Start area simplified to 3 visible buttons:
  - `Start`
  - `Stop`
  - `Handoff`
- Manual `Save` button hidden from primary UI
- Dropdown labels shortened and truncated with `...`
- Input/textarea typography normalized
- Compact layout improved for side-panel use

### Runtime
- One-click start resets loop counter to `0/100`
- Stop phrase detection limited to latest response final line
- Auto-finalize after non-manual stop
- Final export now defaults to single Markdown blueprint download
- Finalize fallback readback added across candidate tabs
- Certification gate restricts production runtime to `ChatGPT + Gemini`

### Architecture
- Popup-level provider registry extracted to `apps/extension/provider-registry.js`
- Injected page functions now use self-contained in-page adapter registry for `executeScript` safety
- Multi-provider expansion path now governed by certification artifacts, not ad-hoc enablement

### Documentation / process
- Deferred baseline test checklist created
- Provider certification contract created
- Provider dossiers created for:
  - Claude
  - DeepSeek
  - Perplexity
  - Grok
- Provider index + adapter TODO map created

## Open risks

- Owner live browser validation not run yet
- ChatGPT/Gemini baseline still needs one real consolidated test pass
- Adapter seam refactor is syntax-verified but not yet owner-validated in browser
- Candidate providers remain documentation-only until certification evidence exists

## Required owner test before trust elevation

Run:
- `docs/TEST_DEBT_2PROVIDER_HARDENING.md`

Minimum trust gate:
- baseline UI pass
- baseline loop pass
- auto-finalize `.md` pass
- manual stop behavior pass
- no serious drift in ChatGPT/Gemini runtime

## Current release posture

Status: `internal-ready-for-owner-test`

Meaning:
- code/docs checkpoint is organized
- production release trust is not yet elevated
- next hard gate is owner live validation
