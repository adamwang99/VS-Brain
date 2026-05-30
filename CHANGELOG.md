# VS Brain Changelog

## v0.8.52-recent-paste-grace-window

- v0.8.51 added a `target_streaming` early-return based on `tState.isGenerating` from the page detector. The user reproduced the same false stop on v0.8.51 and the log shows why: the detector returned `generating=no` even while ChatGPT was clearly streaming an 8888-char response. The DOM markers used to infer `isGenerating` are not reliable across all ChatGPT/Gemini surface variants, so trusting that flag alone is not a defensible gate.
- Replaced the gate with a **timing-based grace window** that does not depend on DOM heuristics:
  - When a relay paste succeeds, store `loopState.lastPasteAt = Date.now()`.
  - On the next loop pass, if the source content hash is still the same (would normally be `duplicate`), check `Date.now() - lastPasteAt`. If the paste happened less than 5 minutes ago, the target may simply still be replying — return `target_streaming` and wait without counting no-progress.
  - If 5 minutes or more have elapsed and the source still has not changed, fall through to the existing `duplicate` branch and the 3-strike `needs_attention_no_new_source_response` stop applies as before.
- Net effect: long, slow generations (8000+ char responses, deep models) no longer trigger a false stop, but a genuinely idle source still gets surfaced after a real wait.

## v0.8.51-target-streaming-no-false-stop

- A user-reported false stop after 3 rounds when ChatGPT was generating a long response (~8888 chars) but slowly: the source-side waiter timed out at 60s, the next loop pass extracted the same source content again (duplicate hash), `noProgressCount` ticked up to 3 across three rounds, and the loop stopped with `needs_attention_no_new_source_response`. Target was still mid-stream the whole time.
- Fixed: before returning `duplicate` from the relay step, the relay now checks the **target** tab's `isGenerating` flag from `detectProviderState`. If the target is still streaming, the relay returns reason `target_streaming` instead. The loop driver treats `target_streaming` as a non-progress event that does **not** advance the round counter and does **not** count toward `noProgressCount`; it simply waits longer (max(delayMs, 10s)) before retrying. Real source-not-replying cases still hit the existing `duplicate` path with the 3-strike stop.
- This restores the v0.8.46+ guarantee that the loop only stops on a meaningful signal (consensus, quality budget, source actually idle), not on the model just being slow.

## v0.8.50-finalize-wait-stable-stream

- v0.8.49 fixed the critique tone via Intent presets, but the first re-test on the cafe prompt still produced a half-sentence final body (1208 bytes ending with "Qận 1,"). Root cause was deeper than the prompt: `waitForTabNewResponseStandalone` returned the moment the latest answer hash changed at all, so finalize extracted the answer mid-stream while the model was still typing.
- Fixed the wait gate: now requires the same hash to be observed at least 3 polls in a row AND `isGenerating=false` from the page detector before returning. Adds a 60s safety fallback if the answer keeps changing trivially. Same defensive timeout, same caller contract; only the readiness criterion changed.
- Result: finalize no longer truncates the final report when the model is still streaming the long blueprint required by the v0.8.49 mandate (≥600 words). Loop relay is unaffected because that path uses its own waiter and stop logic.

## v0.8.49-intent-presets-finalize-rewrite

- Live test on 2 non-technical prompts (cafe business plan, photosynthesis explainer) exposed two real defects in Blueprint mode: (1) the default critique prompt forced a code/security/architecture panel onto every topic, derailing non-technical debates (the photosynthesis run drifted into a meta-discussion about UI text artifacts), and (2) `buildFinalMarkdown` trusted the model's last in-debate response as the final blueprint body, so when forced-finalize fired the saved bundle held a single half-sentence ("đồng thuận tuyệt đối (Verdict: PASS,") instead of a real report.
- Added an Intent selector at Start with 4 presets: Auto / Business / Learning / Tech-Code. Each preset swaps both the critique prompt (panel and review checklist match the intent) and the finalize schema (Business Decision Brief / Learning Brief / generic Final Brief / existing 8-section blueprint for code).
- Finalize prompt now MANDATES the secretary turn to write a complete report (≥600 words) from scratch instead of just acknowledging agreement or echoing the last response. Every section must be filled with real content; truly empty sections are written as 'none' rather than left blank.
- Default Intent is Auto: domain-agnostic critique that stays grounded in the topic, plus a generic Final Brief schema. Code intent preserves the original v0.8.x panel critique and 8-section blueprint, so existing technical workflows are unchanged.
- Same loop core (relay, stop budgets, forced finalize, ledger validator) is reused; only the prompt template + finalize schema swap.
- Regression: existing 10 scenarios still PASS. Live re-verification on the cafe and photosynthesis prompts produces a real, structured Final Brief bundle instead of the empty stub seen in v0.8.48.

## v0.8.48-ledger-quality-validator

- Added a Decision Ledger field validator that runs after finalize when `outputMode=ledger`. It parses the ledger output, counts decision blocks, and tracks how many include each required field (`evidence`, `counter_evidence`, `confidence`, `reverse_if`, `status`).
- Quality grade attached to the saved bundle metadata as `ledgerQuality`:
  - `ok` — ≥80% of decisions have all required fields.
  - `partial` — 40–80%.
  - `poor` — <40% or no decision blocks at all.
- A clear warning line is logged on save (`ledger validator: quality=... decisions=N full=N partial=N reasons=...`) so the user immediately sees if the model produced a sparse ledger.
- Closes the gap noted in v0.8.47 live verify (model filled `evidence`+`status` fully but `counter_evidence`/`confidence` thinly): contract is no longer trust-only on the model, the app measures it.
- Regression: `ledger-validator-sparse` scenario forces a sparse ledger response and asserts the validator detects `partial`/`poor` and reports missing fields.

## v0.8.47-output-mode-decision-ledger

- Added an output-mode selector at Start so the result format is a deliberate choice, not a fixed blueprint:
  - **Blueprint (quick)** — default, debate an idea, unchanged behavior.
  - **Decision Ledger (needs payload)** — requires a pasted evidence payload; every decision must cite evidence quoted from the payload, and unsupported claims are marked `status: unsupported` instead of being presented as decisions.
- Ledger mode is gated: Start is blocked with a clear message if the mode is `ledger` and no evidence payload is provided (input drives output, not just the dropdown).
- The evidence payload is injected into every relay turn (`<<<EVIDENCE ... >>>`) so both AIs anchor critique to real data, and into the finalize prompt via a golden Decision Ledger schema (executive verdict, decisions with evidence/counter-evidence/confidence/reverse_if/status, unsupported claims, open contradictions, next data to collect).
- Finalize bundle metadata now records `outputMode`. Loop core (relay, stop budgets, forced finalize) is reused unchanged; modes differ only in prompt template + payload, not control flow.
- Regression: added `ledger-mode-evidence` scenario proving payload injection + Decision Ledger finalize path.

## v0.8.46-round-budget-finalize

- Fixed second live non-convergence mode surfaced by real ChatGPT<->Gemini smoke (v0.8.45 run timed out at step 19-20 with critical=0): two models kept exchanging NEW content politely with no termination signal (no critical / no repeat / no contradiction / no low-confidence / no stop phrase), so no stop condition ever fired and the loop ran to timeout with no blueprint.
  - Added a content-independent round budget: quality guard now hard-stops with reason `quality_guard_round_budget` once `step >= 12` and `should_continue=false`, regardless of critical/repeat signals. Still gated behind warmup (`step < 8`) and overridden by unanimous peer `should_continue=true`, so a debate that explicitly wants to continue is not cut short.
  - `quality_guard_round_budget` routes into the stop->finalize chain (draft_forced, no blocking confirm) so a polite-but-endless debate still produces a DRAFT blueprint instead of timing out empty.
- Regression: added scenario `polite-no-signal` (critical=0, new content each round, no stop phrase) proving the loop force-finalizes at the round budget instead of running to timeout.

## v0.8.45-convergence-budget-finalize

- Fixed live non-convergence hang surfaced by real ChatGPT<->Gemini production runs (autopilot verdict TIMEOUT at step 22/37, critical climbing 19-20 with criticalStall=0):
  - Added convergence budget: quality guard now hard-stops with reason `quality_guard_no_convergence` when `criticalCount >= 8` and `should_continue=false`, even if there is no repeat/stall. Still gated behind warmup (`step < 8`) and overridden by unanimous live/cached peer `should_continue=true`, so progressing debates are not cut short.
  - Forced-stop reasons (`quality_guard_no_convergence`, `đạt số bước tối đa`) now route into the stop->finalize chain so a non-converging or max-rounds debate still produces a DRAFT blueprint instead of silently ending with nothing.
  - `draft_forced` finalize on a forced stop no longer blocks on `window.confirm` (unattended autopilot safe); the dual-consensus path is unchanged.
- Regression: added scenario `no-convergence-critical-budget` proving the loop force-finalizes instead of running to timeout.

## v0.8.44-critical-stall-needs-real-stall

- Hardened one-click/live runtime against stale popup/session state:
  - `Start` now forces tab re-scan before launching a new loop
  - `Start` clears recovered/stale loop state before new execution
  - invalid `source===target` loop state now stops immediately instead of continuing
- Fixed source/target fallback pairing so one-click no longer prefers `gemini -> gemini` / same-provider pairs when a different-provider AI tab is available.
- Added explicit live surface classification in runtime detection:
  - `conversation`
  - `home`
  - `signin`
  - `interstitial`
- Added explicit fail-fast runtime reasons for live providers:
  - `CHATGPT_SIGNIN_REQUIRED`
  - `CHATGPT_INTERSTITIAL_GATE`
  - `GEMINI_HOME_NOT_BOOTSTRAPPED`
  - `needs_permission_reload`
- Gemini home/new-chat surfaces can now be auto-bootstrapped with a short readiness prompt before the debate relay starts.
- Relay stop-check permission failures now abort clearly instead of spinning in repeated lease/retry loops.
- Expanded host permissions to reduce false permission failures on Google/Gemini redirect surfaces during live runs.
- Runtime result: the extension now surfaces real provider/runtime blockers more honestly instead of hiding them inside infinite `ERR_SOURCE_NOT_READY` churn.

## v0.8.18-g2

- Hardened the production runtime around a certified 2-provider baseline: `ChatGPT + Gemini`.
- Kept the compact primary action UI with `Start`, `Save`, `Stop`, and `Handoff`.
- Safe-release now defaults to `Auto-send OFF`, including the one-click path.
- Auto-loop now requires `Auto-send ON`; otherwise the UI blocks with an explicit message instead of silently pasting and incrementing rounds.
- Finalization no longer trusts stop phrase alone:
  - requires termination envelope
  - requires finalize nonce
  - fails closed on malformed/multiple envelope, nonce mismatch, `should_continue=true`, or `critical_remaining=true`
  - runs judge gate `veto | review_required | no_veto` before export
- Recovery path restores into `recovered_blocked` and forces `Auto-send OFF`.
- Auto handoff uses dual estimator and blocks unreliable handoff without killing the whole loop.
- Added runtime status states for clearer operator feedback: `idle | running | blocked | recovered | ready_to_finalize`.
- Shortened dropdown labels and normalized input typography for cleaner side-panel UX.
- Added release-gate test coverage for runtime skeleton, recovery/finalize, judge fail-closed, handoff estimator, safe release, live official flow, and release matrix verification.

## v0.8.15

- Rewrote `docs/PRODUCT_SPEC.md` into a phased implementation spec for evolving VS Brain from pairwise blueprint relay to multi-agent verified blueprint/spec/execution packet.
- Added sequential checklist across artifact state, roles, judge gate, execution packet export, provider health, roundtable mode, packaging, and deferred monetization.
- Linked roadmap and project status to the new phased spec.

## v0.8.14

- Standardized runtime/debug logs toward English-only output.
- Added log auto-pruning:
  - max 120 lines
  - drops entries older than 30 minutes
  - export log now maps structured log objects back to text lines
- Added `docs/ROADMAP.md` with completion plan for Quality Guard v2, Auto Handoff v3, provider health checks, multi-provider modes, and packaging.

## v0.8.13

- Added Quality Guard v1:
  - tracks repeated latest-answer hash
  - parses confidence signals
  - detects no-new-issues, contradiction, critical/blocker markers
  - stops loop on repeated hash, repeated contradiction, or repeated low confidence
  - logs per-round quality counters
- Upgraded Context Handoff bootstrap instructions to require distillation of requirements, decisions, resolved issues, unresolved issues, and quality risks before continuing.
- Updated README with Quality Guard section.

## v0.8.12

- Added deferred monetization/free-pro upgrade debt to `PROJECT_STATUS.md`:
  - keep current build full-feature internal beta
  - Free tier planned as 20 rounds / 2 providers
  - Pro tier planned for full rounds, multi-provider, Auto Handoff, Roundtable/Judge, advanced gates
  - Chrome Web Store + external license billing recommended later
  - license/plan architecture noted as future requirement

## v0.8.11

- Added Auto Handoff Runtime:
  - checks visible context estimate during each loop step
  - triggers automatically at 70% estimated context usage
  - exports auto handoff Markdown/JSON
  - opens a replacement AI tab
  - injects the handoff bootstrap prompt
  - auto-sends bootstrap when Auto-send is enabled
  - swaps old tab id to the new tab id inside `loopState`
  - resumes the debate loop after handoff
  - stops safely with `auto_handoff_failed` if restore/inject fails

## v0.8.10

- Improved round selection UX:
  - added preset buttons: 25/50/100/200/500/1000
  - added `-10` / `+10` stepper buttons
  - kept direct numeric input up to 1000
  - changed slider to coarse `step=10` so values stop jumping uncontrollably
  - keeps guard that running loops cannot reduce max below the current round

## v0.8.9

- Regenerated extension icons with maximum-size content crop and no extra padding to improve small-icon readability.

## v0.8.8

- Regenerated Chrome extension icons with tight content crop so the logo fills the available icon area and remains readable at 16/32px.

## v0.8.7

- Added supplied VS Brain logo asset to the extension:
  - copied source image to `apps/extension/icons/vs-brain-logo.png`
  - regenerated Chrome extension icons at 16/32/48/128px
  - added logo to the side-panel header
  - added logo to the help modal
  - added animated glow/floating logo styling matching the existing glass/CTA effects
- Updated README branding section and version.

## v0.8.6

- Added Context Handoff Mode:
  - manual `Context handoff` button in the start card
  - exports handoff Markdown and JSON
  - records visible context char/token estimates and estimated usage percent
  - captures provider, URL, conversation id, loop step, stop reason, and latest answer
  - includes structured compressed-state placeholders and a bootstrap prompt for a fresh tab
  - optionally opens a new AI tab after handoff creation
- Rewrote README with full project usefulness, features, safety model, and current status.

## v0.8.5

- Added `require_final_confirm` gate to Finalize & Save:
  - checks stop phrase before sending final blueprint prompt
  - warns user when final agreement is missing
  - allows explicit draft finalize via browser confirm only
  - exports `finalization_mode`, `stop_reason`, and `require_final_confirm` in JSON
  - includes finalization metadata in MD report

## v0.8.4

- Added safe tab restore for auto relay/fill:
  - validates source/target tab still exists and is an AI tab
  - focuses target window/tab before fill
  - retries fill once after restore/rebind
  - stops loop with `needs_attention` instead of continuing when target drift remains
- Added `windows` permission for controlled focus restore.

## v0.5.1

- Fixed EN help modal title/button localization:
  - `Hướng dẫn VS Brain` → `VS Brain guide`
  - `Đóng` → `Close`
- Improved `Finalize & Save` output:
  - exports `final-<provider>-<timestamp>.md`
  - exports `final-<provider>-<timestamp>.json`
  - exports `final-<provider>-<timestamp>-finalize-prompt.md`
- Final MD report now includes structured sections:
  - Final conclusion / Kết luận cuối cùng
  - Unified final answer / Bản trả lời thống nhất
  - Resolved critique points / Các điểm phản biện đã xử lý
  - Remaining assumptions / Giả định, giới hạn còn lại
  - Next actions / Việc cần làm tiếp theo
  - Audit trail
- Final JSON now uses schema `vs-brain.final_report.v1`.

## v0.5.0

- Completed EN localization for core UI/dropdowns/modal placeholders.
- Added English labels for archive buttons and status text.

## v0.4.9

- Moved custom dropdown menus to `document.body` portal layer so they render above glass cards.

## v0.4.8

- Restored rounded glass card clipping.
- Removed layout offset.
- Positioned dropdown menu via button rect.

## v0.4.7

- Attempted dropdown clipping fix by z-index/overflow; superseded by v0.4.8/v0.4.9.

## v0.4.6

- Replaced native selects with custom glass dropdowns.
- Fixed EN UI selector bug.

## v0.4.5

- Added broader UI i18n for VI/EN.
- Improved dropdown style.

## v0.4.4

- Replaced exported help file with in-app help modal.

## v0.4.3

- Added editable critique prompt template.
- Added reset default prompt button.

## v0.4.2

- Added Auto source/target option.
- Set default max steps to 50.
- Switched font stack to Roboto/system.

## v0.4.1

- Applied refined glassmorphism UI styling.

## v0.4.0

- Added VI/EN mode.
- Added Finalize & Save baseline export.
