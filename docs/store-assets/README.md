# Chrome Web Store Assets — VS Brain

## Folder layout

- `screenshots-raw/` — original 1280x882 captures from a live ChatGPT + Gemini session (kept as-is for evidence and re-edits).
- `screenshots-1280x800/` — store-spec screenshots cropped from the raw set. Upload these to the Chrome Web Store developer dashboard.

## Current screenshots

1. `01-loop-100-of-100-finalize.png` — VS Brain side panel showing a 100-round critique debate between ChatGPT and Gemini just before forced-finalize. Demonstrates: long-running structured debate, round counter, Auto-ON / Send-OFF safety pill, archive mode (`canonical archive (.gz) + full MD`).
2. `02-termination-envelope-and-final-brief.png` — final blueprint produced inside ChatGPT, with the structured `vsbrain-termination` envelope visible (`status: ready_to_finalize`, `session_nonce: fin_…`, `should_continue: false`, `critical_remaining: false`). Demonstrates: structured stop contract, secretary final-report prompt, side panel UX.

## Captions to paste in the store dashboard

1. **"100 rounds of structured AI-to-AI critique between ChatGPT and Gemini, with one-click Save."**
2. **"Final blueprint with a fail-closed termination envelope so the AIs can't end the debate prematurely."**

## Required next actions before submit

1. **Re-pack demo from v0.8.56**: run `npm run build:demo` from repo root after checking out the v0.8.56 commit. This produces `exports/demo/vs-brain-0.8.56-demo.zip`. Do NOT upload the older v0.8.50/v0.8.55 demo zips — they contain the Save-loop bug fixed in v0.8.56.
2. **Optional re-shoot**: if Sếp wants the screenshots to also reflect the post-Save state (`.gz` bundle present in Downloads), capture a fresh session on v0.8.56 and replace `02-...png`. Current screenshot is acceptable for the listing as-is because the listing copy emphasises the structured envelope, not the download itself.
3. **Promo tile 440x280** (optional): can be derived from screenshot 1 by cropping the side panel + a sliver of the brief, or rendered separately.

## Source provenance

Original captures supplied by the project owner (Adam Wang) via Telegram on 2026-05-31. JPEG 1280x882 each. Top-cropped to 1280x800 by `Pillow.LANCZOS` (no rescale, no compression beyond default PNG). Conversion script kept inline; no third-party image processing.
