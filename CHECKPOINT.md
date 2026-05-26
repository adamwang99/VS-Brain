# VS Brain Checkpoint

Saved: 2026-05-27 01:50 GMT+7

## Current version

`v0.8.14`

Latest commit:

```text
pending commit: english logs auto prune roadmap v0.8.14
```

## Current state

VS Brain is a Chrome side-panel extension for AI-to-AI critique loops.

Main UX:

- Simple-first UI.
- One-click auto mode.
- Default language: English with flag selector.
- Default debate limit: 100 rounds, slider adjustable up to 1000.
- Running state has animated color effect.
- Loop counter shows current/limit + elapsed timer.
- Finalize button glows strongly as CTA after loop stops.
- Auto relay restores the intended target tab before filling and stops safely on tab drift.
- Finalize requires final agreement phrase or explicit draft confirmation; exports finalization metadata.
- Context Handoff exports compressed reset package for long/degraded debates and can open a fresh tab.
- Supplied logo appears in UI header, help modal, and Chrome extension icons with animated glow.
- Chrome icons are max-cropped with no extra padding so the logo fills the icon area at small sizes.
- Round selection uses presets, direct input, +/-10, and coarse slider step=10 for controllable selection.
- Auto Handoff Runtime can trigger at 70% estimated context, open replacement tab, inject bootstrap, swap loop tab id, and resume.
- Quality Guard v1 stops long loops on repeated hash, repeated contradiction, or repeated low confidence signals.
- Handoff bootstrap now asks model to distill requirements/decisions/resolved/unresolved/quality risks before continuing.
- Runtime logs are being standardized to English and auto-pruned after 30 minutes / 120 lines.
- Completion roadmap recorded in `docs/ROADMAP.md`.
- Monetization/free-pro split is recorded as upgrade debt; current focus remains stabilizing full internal beta first.
- Manual/advanced controls hidden under details.

Core flow:

```text
Open 2 AI tabs
→ Start auto
→ app auto-picks source/target
→ relays latest answer
→ auto-sends
→ stops on agreement phrase or max rounds
→ user clicks Finalize & Save
→ app sends final blueprint prompt
→ waits for final answer
→ exports MD/JSON/prompt
```

Stop phrases:

- EN: `VS_BRAIN_FULL_AGREEMENT`
- VI: `CHỐT_ĐỒNG_THUẬN_HOÀN_TOÀN`

## Last user-requested change completed

- English logs + auto-prune + roadmap:
  - runtime/debug logs standardized toward English
  - max 120 lines
  - auto-drop entries older than 30 minutes
  - export log remains available
  - `docs/ROADMAP.md` records next completion phases

## Pending possible refinements

- Verify UI after reload in Chrome side panel.
- If dropdown layering regresses, inspect portal menu behavior in Chrome extension side panel.
- If finalize does not wait long enough for long answers, expose finalize timeout setting.
