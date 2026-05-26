# VS Brain Changelog

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
