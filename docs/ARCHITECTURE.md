# Architecture

```text
Chrome Extension
  ├─ adapters/chatgpt.ts
  ├─ adapters/gemini.ts
  ├─ core/exporter.ts
  ├─ core/dedupe.ts
  ├─ core/checkpoint.ts
  └─ ui/popup.ts

Local/API Orchestrator
  ├─ workflows/critique-loop
  ├─ providers/api-chatgpt
  ├─ providers/api-gemini
  └─ session logger

Shared Package
  ├─ schemas
  ├─ normalize
  ├─ hash
  └─ markdown
```

## Safety defaults

- Auto-send off by default.
- Visible preview before filling provider input.
- Final answer requires user confirmation.
- Every relay round logged as JSONL.
