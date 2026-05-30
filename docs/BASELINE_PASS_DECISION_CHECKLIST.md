# VS Brain — Baseline Pass Decision Checklist

Saved: 2026-05-27 18:42 GMT+7
Purpose: fast decision gate after owner tests ChatGPT + Gemini baseline

## Baseline decision inputs

Required evidence sources:
- `docs/OWNER_TEST_FORM_SHORT.md`
- `docs/TEST_DEBT_2PROVIDER_HARDENING.md`
- release note / logs / screenshots if any

## Decision checklist

### Must all be true
- [ ] UI layout pass is acceptable
- [ ] ChatGPT + Gemini both recognized correctly
- [ ] auto-pick / loop start behaves correctly
- [ ] counter reset and stop behavior are acceptable
- [ ] auto-finalize `.md` flow works
- [ ] manual Stop does not wrongly auto-finalize
- [ ] no serious wrong-tab drift seen
- [ ] no blocker bug remains open

## Decision

If all checked:
- baseline_state = `accepted`
- next move = choose exactly one provider candidate for live evidence

If any blocker remains:
- baseline_state = `not_accepted`
- next move = patch baseline first

## Rule

Do not start certifying a new provider before baseline_state = `accepted`.
