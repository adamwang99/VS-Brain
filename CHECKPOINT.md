# VS Brain Checkpoint

Saved: 2026-05-27 00:40 GMT+7

## Current version

`v0.8.5`

Latest commit:

```text
pending commit: finalize confirm gate v0.8.5
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

- Finalize confirm gate aligned with spec:
  - require final agreement phrase before normal finalize
  - warn and require explicit confirmation for draft blueprint
  - export `finalization_mode`, `stop_reason`, `require_final_confirm`

## Pending possible refinements

- Verify UI after reload in Chrome side panel.
- If dropdown layering regresses, inspect portal menu behavior in Chrome extension side panel.
- If finalize does not wait long enough for long answers, expose finalize timeout setting.
