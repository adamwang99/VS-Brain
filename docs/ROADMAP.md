# VS Brain Completion Roadmap

## Goal

Move VS Brain from internal beta to reliable long-run critique orchestration.

## Current priority

1. Stabilize pairwise loop under real provider usage.
2. Reduce long-run hallucination and context degradation.
3. Make logs readable, English-only, bounded, and self-pruning.
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

- selector health check per provider
- paste/send/read test button
- provider compatibility matrix

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
