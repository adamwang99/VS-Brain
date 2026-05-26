# VS Brain Project Status

Current version: `v0.5.1`
Current commit target: codebase HEAD after `fix: localize help modal and improve final export v0.5.1`.

## Product purpose

VS Brain is a Chrome side-panel extension that connects open AI provider tabs and relays latest answers between them for structured critique, agreement detection, and final export.

## Main capabilities

- Detect open AI tabs: ChatGPT, Gemini, DeepSeek, Claude, Perplexity, Grok.
- Source/target selection with Auto mode.
- Custom glass dropdowns rendered through body portal layer.
- VI/EN UI and prompt mode.
- Editable critique prompt template + reset to default.
- Latest-response relay with duplicate hash protection.
- Selection-only relay mode.
- Auto A↔B loop with optional Auto-send.
- Stop phrase detection only in latest response.
- Finalize & Save:
  - structured Markdown report
  - machine-readable JSON report
  - finalize prompt file for optional AI secretary pass
- Archive current chat to JSONL/Markdown with checkpoint/dedupe.
- Debug log modal/export.

## Stop phrases

VI:

```text
CHỐT_ĐỒNG_THUẬN_HOÀN_TOÀN
```

EN:

```text
VS_BRAIN_FULL_AGREEMENT
```

## Known limitation

`Finalize & Save` currently creates a structured report from the latest provider response and also exports a finalize prompt. It does not yet automatically send that finalize prompt to an AI secretary and wait for a new synthesized final report.

## Next recommended phase

`v0.6.0`: Finalize autopilot.

Flow:

```text
Detect stop phrase
→ build finalize prompt
→ send to selected secretary provider
→ wait for final synthesized answer
→ export final MD/JSON from synthesized answer
```
