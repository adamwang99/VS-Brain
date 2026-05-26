# VS Brain Checkpoint

Saved: 2026-05-27 01:12 GMT+7

## Current version

`v0.8.9`

Latest commit:

```text
pending commit: max-size icon crop v0.8.9
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

- Icon readability fix v2:
  - crop logo content bounding box
  - regenerate 16/32/48/128 icons with no extra padding
  - maximize logo size inside Chrome icon frame

## Pending possible refinements

- Verify UI after reload in Chrome side panel.
- If dropdown layering regresses, inspect portal menu behavior in Chrome extension side panel.
- If finalize does not wait long enough for long answers, expose finalize timeout setting.
