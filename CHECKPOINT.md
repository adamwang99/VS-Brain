# VS Brain Checkpoint

Saved: 2026-05-27 18:36 GMT+7

## Current version

`v0.8.17`

Latest state:

```text
working tree: hardening wave complete, owner live validation pending
```

## Current state

VS Brain is a Chrome side-panel extension for AI-to-AI critique loops.

### Certified production baseline
- `chatgpt`
- `gemini`

### Candidate providers
- `claude`
- `deepseek`
- `perplexity`
- `grok`

### Main UX now
- 3 visible primary buttons only:
  - `Start`
  - `Stop`
  - `Handoff`
- manual `Save` hidden from primary UI
- dropdown labels shortened with ellipsis
- input typography normalized
- one-click start resets counter to `0/100`
- auto-finalize runs after non-manual stop
- final export defaults to single Markdown blueprint

### Runtime architecture now
- popup-level provider registry in `apps/extension/provider-registry.js`
- self-contained in-page adapter registry inside injected page functions
- certification gate blocks non-certified providers from production loop
- finalize fallback readback exists across candidate tabs

## Current source-of-truth docs
- `PROJECT_STATUS.md`
- `docs/TEST_DEBT_2PROVIDER_HARDENING.md`
- `docs/PROVIDER_CERTIFICATION_CONTRACT.md`
- `docs/PROVIDER_INDEX.md`
- `docs/ADAPTER_TODO_MAP.md`
- `docs/RELEASE_NOTE_v0.8.17_INTERNAL.md`
- `docs/OWNER_TEST_FORM_SHORT.md`
- `docs/RUNTIME_SETTINGS_SPEC.md`
- `docs/providers/claude-certification.md`
- `docs/providers/deepseek-certification.md`
- `docs/providers/perplexity-certification.md`
- `docs/providers/grok-certification.md`

## Pending owner validation
Run later from canonical extension path:

`/home/phuong/.openclaw/workspace/projects/crosscritic/apps/extension`

Primary test docs:
- full checklist → `docs/TEST_DEBT_2PROVIDER_HARDENING.md`
- short form → `docs/OWNER_TEST_FORM_SHORT.md`

## Hard gate
- Do not add any provider beyond `chatgpt` and `gemini` to production loop before contract pass and live evidence.

## Best next step after owner returns
1. run short owner form
2. run full deferred checklist if needed
3. choose exactly one candidate provider for live evidence collection
4. upgrade that provider only if all certification gates pass

## Runtime note
- current executing runtime is rollback-good baseline restored from `*.bak-20260527-1550`
- regressed refactor snapshot preserved at `projects/crosscritic/memory_snapshots/v0.8.17-runtime-regression-20260527-221837/`
- re-apply changes later using `docs/SAFE_REAPPLY_CHANGESET.md`

## Post-test scaffolding
- `docs/PROVIDER_EVIDENCE_TEMPLATE.md`
- `docs/BASELINE_PASS_DECISION_CHECKLIST.md`
- `docs/ROLLOUT_NEXT_PROVIDER_PLAN.md`
- `docs/ADAPTER_CONTRACT_SPEC.md`
