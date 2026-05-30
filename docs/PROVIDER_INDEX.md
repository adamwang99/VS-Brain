# VS Brain — Provider Index

Saved: 2026-05-27 18:25 GMT+7
Purpose: one-page provider status map for runtime, certification, and next action

## Status summary

### Certified baseline

| Provider | Runtime state | Allowed in production loop | Dossier | Next action |
|---|---|---:|---|---|
| `chatgpt` | certified-baseline | yes | baseline runtime only | validate via deferred 2-provider test pass |
| `gemini` | certified-baseline | yes | baseline runtime only | validate via deferred 2-provider test pass |

### Candidate providers

| Provider | Runtime state | Allowed in production loop | Dossier | Next action |
|---|---|---:|---|---|
| `claude` | candidate | no | `docs/providers/claude-certification.md` | collect live evidence after baseline pass |
| `deepseek` | candidate | no | `docs/providers/deepseek-certification.md` | collect live evidence after baseline pass |
| `perplexity` | candidate | no | `docs/providers/perplexity-certification.md` | collect live evidence after baseline pass |
| `grok` | candidate | no | `docs/providers/grok-certification.md` | collect live evidence after baseline pass |

## Current runtime gate

Production gate now:
- `chatgpt`
- `gemini`

Blocked from production loop until certified:
- `claude`
- `deepseek`
- `perplexity`
- `grok`

## Rules

- A provider may enter production loop only after contract pass:
  - `docs/PROVIDER_CERTIFICATION_CONTRACT.md`
- Current baseline must remain stable after any new provider enablement.
- Only one new provider should be enabled per certification wave.

## Expansion order

Recommended next certification order:
1. `claude`
2. `deepseek`
3. `perplexity`
4. `grok`

## Related docs

- Certification contract: `docs/PROVIDER_CERTIFICATION_CONTRACT.md`
- Deferred baseline test: `docs/TEST_DEBT_2PROVIDER_HARDENING.md`
- Claude dossier: `docs/providers/claude-certification.md`
- DeepSeek dossier: `docs/providers/deepseek-certification.md`
- Perplexity dossier: `docs/providers/perplexity-certification.md`
- Grok dossier: `docs/providers/grok-certification.md`
