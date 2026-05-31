# Chrome Web Store Assets — VS Brain

## Folder layout

- `screenshots-raw/` — original 1280x844 happy-path captures from a real ChatGPT + Gemini session running v0.8.58 with the content-script page-helpers fix in place.
- `screenshots-1280x800/` — store-spec screenshots cropped from the raw set. Upload these to the Chrome Web Store developer dashboard in this exact order.

## Current screenshots (happy-path set, replaces the earlier 100/100 force-finalize set)

1. `01-running-structured-debate.png` — VS Brain side panel running on real ChatGPT + Gemini (`v0.8.58-content-script-page-helpers`, Running 1/100, Auto ON, canonical archive). The Gemini tab on the right shows a structured critique response (`Verdict: PASS`, `Confidence: 10`, `should_continue: false`). Demonstrates: live AI-to-AI critique relay, structured response format, side panel UX.
2. `02-fail-closed-confirm-draft.png` — Native Chrome confirm dialog from the extension after the loop stops with only one tab carrying the stop phrase (`No final agreement phrase found on both tabs. Stop reason: một tab đã chốt ở dòng cuối: VS_BRAIN_FULL_AGREEMENT. Create a DRAFT blueprint anyway?`). Demonstrates: fail-closed gate that refuses to finalize a single-sided debate without explicit user confirmation.
3. `03-final-brief-and-bundle-downloaded.png` — ChatGPT shows the produced Final Brief with the structured `vsbrain-termination` envelope (`status: ready_to_finalize`, `should_continue: false`, `critical_remaining: false`); Chrome Recent downloads bar shows `final-blueprint-chatgpt-1780211446225-bundle.json.gz · 6.6 KB · Done`. Demonstrates: structured export to disk, real artifact path users can audit.

## Captions to paste in the store dashboard

1. **"Run a structured AI-to-AI critique loop between ChatGPT and Gemini directly from a Chrome side panel."**
2. **"Fail-closed finalization: the extension refuses to draft a one-sided agreement without your explicit confirmation."**
3. **"Save once: structured Final Brief plus a `.json.gz` bundle written to your Downloads folder."**

## Required next actions before submit

1. **Re-pack demo zip from the latest commit** (`npm run build:demo` from repo root). The current shipping line is v0.8.59+ with the page-helpers refactor and the bilingual intent/output hints. Do NOT upload the older v0.8.50/v0.8.55 demo zips — they contain the Save-loop / ReferenceError bugs fixed in v0.8.56–v0.8.58.
2. **Promo tile 440x280** (optional): can be derived from screenshot 1 by cropping the side panel + a sliver of the brief, or rendered separately.
3. **Sếp confirm**: support email used in the developer dashboard.
4. **Sếp confirm**: enable GitHub Pages on `main` with `/docs` so `https://adamwang99.github.io/VS-Brain/privacy.html` is live.

## Source provenance

Original captures supplied by the project owner (Adam Wang) via Telegram on 2026-05-31, taken on Chrome with VS Brain v0.8.58. JPEG 1280x844 each. Top-cropped to 1280x800 by `Pillow.LANCZOS` (no rescale, no compression beyond default PNG). The earlier `01-loop-100-of-100-finalize.png` / `02-termination-envelope-and-final-brief.png` set was retired because it captured the v0.8.55 Save-loop state and would have shipped a screenshot of a known bug; replaced by this happy-path set captured against the fixed runtime.
