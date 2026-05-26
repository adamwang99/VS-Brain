# VS Brain Product Spec

## Primary user need

User chats with multiple AI providers and manually copy/pastes outputs for critique. The app should archive conversations incrementally and orchestrate critique loops across selected providers.

## Core concepts

### Conversation archive

- `messages.jsonl`: append-only source-of-truth
- `conversation.md`: generated readable view
- `checkpoint.json`: last exported key/hash/time

### Message identity

Preferred key:

```text
platform + conversation_id + native_message_id
```

Fallback key:

```text
platform + conversation_id + role + sha256(normalized_content)
```

### Relay modes

1. Assisted mode: auto-fill prompt, user confirms send.
2. Autopilot mode: auto-fill + auto-send, disabled by default.
3. API mode: provider APIs instead of web UI.

### Stop conditions

```json
{
  "max_rounds": 5,
  "stop_if_score_above": 8.5,
  "stop_if_no_new_issues": true,
  "stop_if_repeated_hash": true,
  "require_final_confirm": true
}
```
