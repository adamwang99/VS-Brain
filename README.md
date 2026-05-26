# VS Brain

VS Brain is a Chrome side-panel extension for running structured AI-to-AI critique loops across web AI tabs such as ChatGPT, Gemini, Claude, DeepSeek, Perplexity, and Grok.

It turns ad-hoc copy/paste between AI tools into a governed workflow: scan conversations, relay only the latest answer, force structured critique, stop on explicit agreement, finalize a blueprint, and preserve checkpoints when context gets too large.

Current extension version: `v0.8.6`.

## Why it is useful

Long AI debates fail in predictable ways:

- context grows until old requirements are diluted
- lower-tier models may replace stronger models after quota changes
- models start repeating old issues instead of reducing uncertainty
- apparent agreement can be false when the stop phrase appears too early
- final blueprints can look polished while missing unresolved blockers

VS Brain adds operational guardrails around that process.

## Core capabilities

### 1. One-click AI debate loop

Open two supported AI tabs, then press **Start auto**. VS Brain can:

- auto-pick source and target tabs
- extract the latest assistant answer
- build a structured critique prompt
- paste it into the other provider
- optionally auto-send
- switch direction after each round
- stop when agreement is detected or the max step limit is reached

### 2. Strong critique prompt discipline

The default prompt asks the receiving model to review from multiple roles:

- systems architect
- implementation engineer
- UX reviewer
- security/privacy reviewer
- fact/evidence checker
- product manager

The model must return verdict, critical issues, missing pieces, suggested fixes, confidence, and whether the debate should continue.

### 3. Explicit final agreement gate

VS Brain uses explicit stop phrases:

- English: `VS_BRAIN_FULL_AGREEMENT`
- Vietnamese: `CHỐT_ĐỒNG_THUẬN_HOÀN_TOÀN`

`Finalize & Save` now enforces `require_final_confirm` behavior:

- if the final agreement phrase exists, finalization is `confirmed`
- if not, the user must explicitly confirm draft finalization
- draft outputs are marked as `draft_forced`
- exports include `stop_reason` and `require_final_confirm`

This prevents a manually stopped or degraded debate from being silently treated as fully agreed.

### 4. Safe tab restore / drift guard

When the user switches tabs during an auto loop, VS Brain restores the intended target tab before filling.

Guard behavior:

- validates the tab still exists
- validates it is still a supported AI tab
- focuses the correct window/tab before fill
- retries fill once after restore/rebind
- stops with `needs_attention` instead of continuing if the target remains unsafe

This avoids writing into the wrong tab or continuing blindly after UI drift.

### 5. Context Handoff Mode

Context Handoff Mode solves the “200 rounds + high context + weaker model” failure mode.

When a conversation becomes too long, the user can create a handoff checkpoint instead of copying full history into a new tab.

The handoff exports:

- `vs-brain/context-handoff-<provider>-<timestamp>.md`
- `vs-brain/context-handoff-<provider>-<timestamp>.json`

The handoff includes:

- provider, title, URL, conversation id
- message count
- estimated visible context characters/tokens
- estimated context usage percentage
- loop step/max step
- last stop reason
- latest answer
- structured placeholders for:
  - requirements / invariants
  - decisions already accepted
  - resolved issues
  - unresolved issues / blockers
  - next critique focus
- bootstrap prompt for a new tab

Important: web UI mode cannot know true provider context usage. VS Brain marks these values as estimates. They are still useful as a guardrail.

### 6. Conversation archive and checkpointing

VS Brain can scan the current AI chat and export:

- new messages as JSONL
- new messages as Markdown
- full conversation as JSONL
- full conversation as Markdown

It stores per-conversation checkpoints in `chrome.storage.local` to avoid duplicate exports.

### 7. Final blueprint export

After finalization, VS Brain exports:

- final blueprint Markdown
- final blueprint JSON
- finalization prompt Markdown

The JSON includes machine-readable finalization metadata.

## Operating model

```text
Open 2 AI tabs
→ Start auto
→ VS Brain relays latest answer only
→ providers critique each other
→ stop phrase or max steps stops loop
→ if agreement exists: Finalize confirmed
→ if no agreement: user may explicitly force draft
→ if context is too large: create Context Handoff
→ continue in a fresh tab from compressed state
```

## Safety rules

- Auto-send is optional but enabled in the one-click flow.
- Stop phrase is accepted only in the latest response.
- Manual stop does not equal final agreement.
- Missing final agreement requires explicit user confirmation before blueprint generation.
- Handoff mode should be used when context is high, model quality drops, or debate starts repeating.
- Context estimates are heuristic in web UI mode; API mode would be required for exact token usage.

## Current implementation status

Implemented in `apps/extension`:

- Chrome Manifest V3 side-panel extension
- multi-provider AI tab discovery
- latest-answer extraction
- assisted relay and auto-loop
- stop phrase gate
- max step control up to 1000 via slider
- elapsed timer
- stronger final CTA glow
- safe target-tab restore
- final confirm / draft forced gate
- context handoff export
- JSONL/Markdown conversation export
- debug log export

## Repo layout

```text
apps/extension/      Chrome extension for web UI export/relay
packages/shared/    Shared schemas, hashing, normalization helpers
docs/               Product/spec/design notes
exports/            Local ignored sample/export target
```

## Load locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click **Load unpacked**.
4. Select `apps/extension`.
5. Pin VS Brain or open it from the side panel.

After code changes, click **Reload** on the extension card.

## Limitations

- Web UI mode cannot read exact model token usage or true provider context window usage.
- Context usage is estimated from visible DOM text and prompt payload size.
- Provider UI selectors may change; use the debug log when paste/send fails.
- API mode is not implemented yet.

## Version history

See `CHANGELOG.md`.
