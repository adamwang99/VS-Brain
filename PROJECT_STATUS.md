# VS Brain Project Status

Current version: `v0.8.53-msg-count-detection`
Latest local state: `working tree includes 2-provider hardening, fail-closed finalize gate, safe-release default OFF, auto-handoff estimator hardening, runtime surface classification, Gemini home auto-bootstrap, fail-fast permission/source gates, and live-loop UX hardening; not committed yet`

## Product purpose

VS Brain is a Chrome side-panel extension that connects open AI provider tabs and runs structured AI-to-AI critique loops. It turns manual copy/paste between AI tools into a governed workflow: latest-answer relay, critique discipline, agreement detection, final blueprint export, archive/checkpoint, and context handoff for long sessions.

## Current capabilities

New in current local dev state:
- Runtime certification gate: production loop currently limited to certified providers `ChatGPT + Gemini`
- One-click `Start` now auto-refreshes tab inventory and clears stale recovery state before launching a new loop
- Source/target auto-pick now avoids same-provider fallback pairs when a different-provider target exists
- Live surface classifier distinguishes `conversation`, `home`, `signin`, and `interstitial` states
- Gemini home/new-chat can be auto-bootstrapped before relay so users do not need to manually seed the target first
- Permission/source readiness failures now fail fast with actionable reasons instead of repeated lease/retry loops
- Compact action layout with `Start / Save / Stop / Handoff`
- Safe-release path now keeps `Auto-send OFF` by default, including one-click start
- Auto-loop requires `Auto-send ON`; otherwise it blocks explicitly instead of silently pasting and advancing rounds
- Fail-closed finalization stack:
  - termination envelope
  - finalize nonce lifecycle
  - reject malformed/multiple envelope
  - reject nonce mismatch
  - reject `should_continue=true`
  - reject `critical_remaining=true`
  - judge gate `veto / review_required / no_veto`
- Recovery path restores into `recovered_blocked` and forces `Auto-send OFF`
- Auto handoff dual estimator with `unreliable` block path
- Runtime status states clarified for operators
- Shortened provider labels in tab pickers for cleaner dropdown UX
- Input/textarea font normalization for cleaner side-panel typography

Core runtime:
- Detect open AI tabs via provider host map; production-certified runtime currently enables ChatGPT and Gemini.
- Pairwise source/target debate loop: A ↔ B.
- One-click auto mode with auto source/target, latest-answer relay, and safe-release default `Auto-send OFF`.
- Manual mode with source/target selection, selection relay, editable prompt template, reset prompt.
- Round control UX:
  - presets: 25/50/100/200/500/1000
  - direct numeric input up to 1000
  - +/-10 controls
  - coarse slider step=10
  - cannot reduce below current running round.
- Stop phrase detection only in latest response final line.
- Finalize runtime:
  - confirmed finalization when stop phrase exists
  - explicit draft confirmation when no stop phrase exists for manual finalize
  - termination envelope + nonce + fail-closed parser required before export
  - judge gate can veto/review before export
  - exports a structured final bundle artifact in the current hardened flow.
- Safe tab restore / drift guard:
  - validates target/source tab still exists and is a certified AI tab
  - focuses intended target before fill
  - retries fill once
  - stops with `needs_attention` instead of continuing blindly.
- Context Handoff Mode:
  - manual handoff export `.md/.json`
  - estimated visible context chars/tokens/usage %
  - latest answer + loop metadata + stop reason
  - bootstrap prompt for a clean tab.
- Auto Handoff Runtime:
  - checks estimated context during loop
  - triggers at 70% estimated usage when estimator is reliable
  - blocks blind handoff when estimator state is `unreliable`
  - exports handoff artifacts
  - opens replacement tab
  - injects bootstrap prompt
  - Auto-sends if enabled
  - swaps old tab id in `loopState`
  - resumes loop or stops safely on real handoff failure.
- Conversation archive:
  - export new/full JSONL
  - export new/full Markdown
  - full bundle export remains available in archive tools
  - checkpoint/dedupe via `chrome.storage.local`.
- UI/brand:
  - supplied VS Brain logo in header/help modal
  - regenerated Chrome icons 16/32/48/128 with max crop
  - animated glow/floating logo treatment.
- Debug log export.

## Current operating mode

Current extension is still an internal/beta full-feature build. Do not implement paid gating until the core product is stable in real usage.

## Technical limitations

- Current loop is pairwise only: one source and one target per run.
- Provider architecture remains extensible, but production runtime is temporarily certified only for ChatGPT and Gemini until additional providers pass selector/runtime certification.
- Web UI mode cannot measure true provider context usage; context usage is estimated from visible DOM and payload size.
- Web UI mode cannot reliably detect provider model downgrade unless provider UI exposes model state in DOM.
- Provider DOM selectors can break when web apps change their UI.
- Live providers may still present auth, sign-in, interstitial, or anti-bot surfaces that the extension cannot bypass; current runtime classifies and stops clearly when this happens.
- No license/paid feature gate yet.
- No Chrome Web Store packaging/review workflow yet.

## Upgrade debt / deferred monetization plan

Decision: continue improving the full internal product first. Paid/free split and billing will be implemented later after the app works reliably.

Planned Free tier:

- max 20 rounds
- max 2 providers
- pairwise A↔B mode only
- basic archive/export
- manual Context Handoff only
- no Auto Handoff Runtime
- no Roundtable/Judge mode
- optional watermark in exports: `Generated by VS Brain Free`

Planned Pro / Full tier:

- up to 1000 rounds
- 3–6 providers
- Roundtable mode
- Judge/Aggregator mode
- Auto Handoff Runtime
- advanced stop gates
- model/context degradation guard
- custom prompt templates
- batch export
- local encrypted archive or advanced archive options

Planned distribution:

- publish one extension on Chrome Web Store
- Free by default
- Pro unlock via external license/billing
- likely billing options: Lemon Squeezy, Stripe, or Paddle
- avoid maintaining separate Free and Pro extensions unless required later.

Required architecture before monetization:

- central `license.js` / `plan.js`
- feature gates:
  - `canUse(feature)`
  - `getLimit(name)`
- plan config:

```json
{
  "plan": "free|pro",
  "max_rounds": 20,
  "max_providers": 2,
  "auto_handoff": false,
  "roundtable": false,
  "judge_mode": false
}
```

- UI plan badge: Free / Pro
- upgrade link
- graceful downgrade when license expires
- export history must remain accessible after downgrade.

## Next recommended product phases before monetization

1. Stabilize pairwise loop with real ChatGPT/Gemini usage and certify the current hardened runtime.
2. Add explicit settings for Auto Handoff threshold and enable/disable toggle.
3. Add model downgrade manual flag and optional DOM detection where possible.
4. Add provider adapter contract + certification checklist before re-enabling Claude/DeepSeek/Perplexity/Grok.
5. Add test matrix per provider and selector health checks.
6. Package for Chrome Web Store beta.
7. Only then implement Free/Pro gating and billing.

## Sequential implementation spec

See `docs/PRODUCT_SPEC.md` for the phased checklist from pairwise blueprint relay to multi-agent verified execution packet.

## Demo trial scope

Current demo recommendation: restrict user trial builds to **ChatGPT + Gemini** only. Additional providers should be re-enabled only after provider-specific selector/runtime certification. This is a temporary certification gate, not a permanent product limitation.

Deferred live validation checklist: `docs/TEST_DEBT_2PROVIDER_HARDENING.md`
Provider certification contract: `docs/PROVIDER_CERTIFICATION_CONTRACT.md`
Provider index: `docs/PROVIDER_INDEX.md`
Adapter TODO map: `docs/ADAPTER_TODO_MAP.md`
Internal release note: `docs/RELEASE_NOTE_v0.8.43_INTERNAL.md`
Owner short test form: `docs/OWNER_TEST_FORM_SHORT.md`
Runtime settings spec: `docs/RUNTIME_SETTINGS_SPEC.md`
Adapter contract spec: `docs/ADAPTER_CONTRACT_SPEC.md`
Provider evidence template: `docs/PROVIDER_EVIDENCE_TEMPLATE.md`
Baseline pass decision checklist: `docs/BASELINE_PASS_DECISION_CHECKLIST.md`
Rollout next provider plan: `docs/ROLLOUT_NEXT_PROVIDER_PLAN.md`
Rollback-good runtime note: `docs/ROLLBACK_GOOD_RUNTIME_NOTE.md`
Safe re-apply changeset: `docs/SAFE_REAPPLY_CHANGESET.md`
Provider dossiers:
- `docs/providers/claude-certification.md`
- `docs/providers/deepseek-certification.md`
- `docs/providers/perplexity-certification.md`
- `docs/providers/grok-certification.md`
