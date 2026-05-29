# VS Brain Completion Roadmap

## Goal

Move VS Brain from internal beta to reliable long-run critique orchestration.

## Current priority

1. Keep the certified `ChatGPT + Gemini` pair stable under real usage.
2. Preserve the fail-closed safety stack already landed: safe-release OFF default, recovery block, finalize envelope + judge gate, and estimator unreliable block.
3. Reduce long-run hallucination and context degradation.
4. Add provider health checks before adding paid gating.

## Near-term upgrades

### Quality Guard v2

- configurable thresholds
- export quality timeline
- distinguish weak signal vs hard stop
- detect repeated semantic content, not only hash

### Auto Handoff v3

- user-configurable threshold
- handoff enable/disable toggle
- better distillation prompt
- post-handoff verification before resume

### Provider stability

- certify ChatGPT + Gemini as the stable pair first
- selector health check per provider
- paste/send/read test button
- provider compatibility matrix
- expand to Claude/DeepSeek only after stable-pair certification

### Multi-provider phase

- Roundtable mode: A → B → C → D → A
- Judge mode: critics feed one verifier
- quorum rules before final confirm

### Packaging

- Chrome Web Store checklist
- privacy policy
- permission minimization
- versioned release zip

## Deferred monetization

Free/Pro gating remains deferred until runtime is stable. See `PROJECT_STATUS.md`.


## Execution spec

Sequential implementation checklist lives in `docs/PRODUCT_SPEC.md`.
