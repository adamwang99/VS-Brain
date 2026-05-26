# VS Brain Product Spec v2

## Status

Draft for sequential implementation.

## Product direction

VS Brain is evolving from a pairwise AI critique relay into a controlled multi-agent orchestration workbench.

Current product:

```text
Idea / answer
→ pairwise critique loop
→ final blueprint export
```

Target product:

```text
Idea
→ structured multi-agent critique
→ verified artifact state
→ judge gate
→ blueprint / spec / execution packet
```

## Strategic objective

Build an application that can orchestrate multiple AI agents/providers toward a final usable output while staying:

- safe against context bloat
- resistant to false agreement
- bounded in cost/time/rounds
- inspectable through logs and artifacts
- resumable after handoff

## Output levels

VS Brain should support 3 output tiers.

### Level 1 — Blueprint

For early ideation and decision support.

Outputs:
- final blueprint summary
- decisions
- assumptions
- next actions

### Level 2 — Spec

For product/engineering planning.

Outputs:
- problem statement
- requirements
- constraints
- architecture or solution outline
- acceptance criteria
- risks
- implementation checklist

### Level 3 — Execution Packet

For downstream implementation by humans or coding agents.

Outputs:
- structured spec
- task breakdown
- priority order
- verification plan
- QA checklist
- open questions
- execution-ready JSON schema

## Core principles

1. State over free-form chat history.
2. Finality must be earned, not inferred from style.
3. Provider runtime is separate from agent role.
4. Long-run loops require budget guards and handoff.
5. Every automation step must have a safe stop reason.

## Functional architecture

### 1. Runtime layers

#### Layer A — Provider runtime

Supported web providers (target state):
- ChatGPT
- Gemini
- Claude
- DeepSeek
- Perplexity
- Grok

Near-term stability scope:
- Phase 1 production focus: ChatGPT + Gemini only
- Other providers are expansion phases after selector/runtime health is proven on the stable pair

Responsibilities:
- detect tab
- read latest answer
- fill prompt
- send prompt
- detect response arrival
- detect failure

#### Layer B — Agent role layer

Initial required roles:
- Architect
- Critic
- Fact Checker
- Security Reviewer
- UX Reviewer
- Implementation Planner
- Judge
- Secretary

Each role uses a prompt contract and contributes to state updates.

#### Layer C — Orchestration layer

Modes:
- Pair mode
- Roundtable mode
- Judge mode

#### Layer D — Artifact layer

Internal source-of-truth for the run.

```json
{
  "schema": "vs-brain.artifact_state.v1",
  "goal": "blueprint|spec|execution_packet",
  "requirements": [],
  "constraints": [],
  "decisions": [],
  "resolved_issues": [],
  "open_issues": [],
  "risks": [],
  "evidence": [],
  "tasks": [],
  "acceptance_criteria": [],
  "open_questions": [],
  "confidence": null,
  "finality_score": null
}
```

## Required major features

### Feature A — Artifact State v1

Problem:
Current loop depends too much on latest answer and visible chat history.

Goal:
Maintain a structured state object throughout the run.

Must-have:
- create `artifactState` at run start
- update after each meaningful round
- persist to local storage per run
- expose export to JSON/Markdown

Done when:
- a long run can stop/resume without losing requirements/decisions/open issues
- handoff can use structured state instead of only latest answer

### Feature B — Agent Roles v1

Problem:
Providers are not the same as roles.

Goal:
Allow a run to assign role prompts independently from provider choice.

Must-have:
- role selector in UI or config preset
- role prompt library
- at least 4 working roles in first release:
  - Architect
  - Critic
  - Judge
  - Secretary

Done when:
- same provider can be reused with different roles
- run logs clearly indicate role + provider

### Feature C — Quality Guard v2

Problem:
Current quality guard is useful but still shallow.

Goal:
Detect drift, low-confidence degradation, repeated loops, and unresolved contradictions more reliably.

Must-have:
- configurable thresholds
- repeated semantic similarity guard
- no-new-issues streak tracking
- contradiction streak tracking
- low confidence streak tracking
- quality timeline export

Done when:
- the loop stops with an explainable guard reason before obvious drift becomes severe

### Feature D — Auto Handoff v3

Problem:
Current auto handoff uses heuristics and text bootstrap only.

Goal:
Resume safely after context bloat using structured artifact state.

Must-have:
- user-configurable threshold
- handoff on/off toggle
- use `artifactState` in bootstrap
- post-handoff verification step
- max handoff count per run
- explicit `handoff_reason`

Done when:
- a long run can handoff multiple times without visibly losing state quality

### Feature E — Judge Gate v1

Problem:
Stop phrase alone is not enough for finality.

Goal:
Require an independent judge pass before confirmed finalization.

Judge outputs:
- PASS
- FAIL
- NEEDS_REVISION

Must-have:
- dedicated judge prompt
- explicit final gate
- `confirmed` only if judge PASS
- `draft_forced` if user overrides without judge PASS

Done when:
- final artifacts can distinguish “agreed style” from “verified finality”

### Feature F — Execution Packet export v1

Problem:
Blueprint is not enough for real implementation workflows.

Goal:
Export structured execution packet.

Must-have fields:
- objective
- requirements
- decisions
- risks
- tasks
- acceptance criteria
- test plan
- open questions

Done when:
- output can be handed to a coding agent or human implementer without replaying the debate

### Feature G — Provider Health Check

Problem:
Automation fails silently when provider DOM changes or login/quota state breaks.

Goal:
Verify provider readiness before long runs.

Must-have:
- per-provider read/fill/send test
- health summary in UI
- selector failure reason
- compatibility matrix doc

Done when:
- user can see which providers are safe before launching a long run

### Feature H — Roundtable Mode

Problem:
Current orchestration is pairwise only.

Goal:
Support 3–6 agents/providers in a bounded sequence.

Example:

```text
Architect draft
→ Critic A
→ Critic B
→ Security
→ Aggregator
→ Judge
```

Must-have:
- ordered participant list
- bounded turn routing
- quorum/final gate rules
- stop budget per stage

Done when:
- a run can use more than 2 providers without degenerating into uncontrolled loops

## Safety requirements

### Finality safety

Confirmed finalization requires:
- no critical blockers
- no unresolved contradiction
- no missing evidence that changes the outcome
- confidence >= 9/10
- judge PASS

### Loop safety

Every run must have:
- max rounds
- max time
- max handoffs
- max repeated hash/semantic repeats
- max provider failures

### Handoff safety

Every handoff must record:
- reason
- source provider/tab
- estimated context usage
- artifact state snapshot
- whether resume succeeded

## Sequential implementation checklist

### Phase 1 — Stabilize stateful pair mode

- [ ] Create `artifactState` runtime object
- [ ] Persist artifact state in local storage
- [ ] Export artifact state JSON/MD
- [ ] Attach role metadata to run state
- [ ] Add UI for goal selection: blueprint/spec/execution_packet

### Phase 2 — Improve quality control

- [ ] Quality Guard v2 thresholds
- [ ] semantic repeat guard
- [ ] quality timeline export
- [ ] visible stop reasons in UI
- [ ] configurable quality strictness

### Phase 3 — Upgrade handoff

- [ ] handoff enable/disable toggle
- [ ] threshold setting
- [ ] use artifact state in bootstrap
- [ ] post-handoff verification pass
- [ ] max handoff count

### Phase 4 — Add judge gate

- [ ] role preset: Judge
- [ ] judge prompt contract
- [ ] judge PASS required for `confirmed`
- [ ] override path produces `draft_forced`
- [ ] judge result visible in exports

### Phase 5 — Export richer outputs

- [ ] blueprint schema v2
- [ ] spec schema v1
- [ ] execution packet schema v1
- [ ] Markdown + JSON for each goal type

### Phase 6 — Provider stability

- [ ] provider health test button
- [ ] read/fill/send diagnostics
- [ ] compatibility matrix doc
- [ ] login/quota/error detection where possible
- [ ] stable pair certification: ChatGPT + Gemini
- [ ] provider rollout gate before enabling next provider

### Phase 7 — Multi-provider orchestration

- [ ] roundtable participant model
- [ ] stage router
- [ ] aggregator role
- [ ] judge stage after aggregation
- [ ] bounded budget per stage

### Phase 8 — Packaging and release discipline

- [ ] Chrome Web Store checklist
- [ ] privacy policy
- [ ] permission review
- [ ] release ZIP/version process
- [ ] onboarding guide

### Phase 9 — Deferred monetization

- [ ] license architecture
- [ ] plan gating
- [ ] Free 20-round / 2-provider limit
- [ ] Pro unlock
- [ ] billing integration

## Recommended implementation order now

Start immediately with:
1. Artifact State v1
2. Agent Roles v1
3. Judge Gate v1
4. Execution Packet export v1
5. Provider Health Check
6. Roundtable Mode

## Product positioning after completion

VS Brain should no longer be positioned only as:

```text
idea → blueprint
```

It should be positioned as:

```text
idea → multi-agent critique → verified blueprint/spec/execution packet
```
