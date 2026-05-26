# CrossCritic

Cross-provider AI chat archive + critique relay.

## Goal

Turn ChatGPT/Gemini/other web chats into a logged critique workflow:

- Incremental export to JSONL/Markdown
- Per-conversation checkpoint + dedupe
- Provider-to-provider critique relay
- Assisted auto-fill by default
- Optional autopilot with strict stop conditions

## Principles

- JSONL is source-of-truth
- Markdown is generated view
- Dedupe by stable key + content hash
- Human confirmation before auto-send by default
- No infinite loops: max rounds + issue/score/hash stop gates

## Repo layout

```text
apps/extension/      Chrome extension for web UI export/relay
apps/orchestrator/  Local/API debate loop engine
packages/shared/    Shared schemas, hashing, markdown, checkpoint logic
docs/               Product/spec/design notes
exports/            Local ignored sample/export target
```

## MVP

1. ChatGPT/Gemini current conversation export
2. JSONL append + dedupe
3. Markdown generation
4. Manual checkpoint + auto checkpoint
5. Assisted relay: copy latest answer → fill other provider critique prompt
6. Debate session log
