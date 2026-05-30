# VS Brain Baseline Architecture V1.0 Candidate

## Status
- Candidate
- Implementation Spike: Approved with controls
- Production Freeze: Not approved
- Full close/final claim: Not approved
- should_continue: true

## Executive conclusion
VS Brain đã đủ rõ để bước vào giai đoạn Implementation Spike có kiểm soát, nhưng chưa đủ bằng chứng để:
- freeze production architecture
- bật mặc định automation side effects rủi ro cao
- tự nhận đã triệt tiêu toàn diện rủi ro
- nâng trạng thái lên `Baseline V1.0` hoặc `Final`

Điểm cốt lõi của Candidate này:
1. xác định kiến trúc đúng hướng
2. khóa thuật ngữ đúng trạng thái trưởng thành
3. bắt buộc hiện thực hóa các cơ chế concurrency / idempotency trước khi claim safe automation
4. bắt buộc có evidence test trước khi nâng trạng thái tài liệu

---

## Scope of this document
Tài liệu này là nguồn triển khai cho giai đoạn spike, tập trung vào 4 bài toán kỹ thuật cứng:
1. IPC Message Contract
2. Session-based Lease
3. Idempotency / Deduplication cho side effects
4. Implementation Spike gate + acceptance evidence

---

## What is already true
Baseline runtime hiện tại đã có và đã verify ở mức heuristic working baseline:
- pairwise critique loop `ChatGPT ↔ Gemini`
- long-run round control tới `1000`
- quality guard
- stop phrase discipline
- structured handoff state
- auto handoff runtime
- live smoke baseline pass

Nhưng các điểm trên **không đủ** để suy ra rằng:
- auto-send đã an toàn trong mọi race/restart path
- finalize không thể lặp
- multi-tab session conflict đã được giải quyết
- service worker restart recovery đã đáng tin
- side effects đã idempotent

---

## Core architecture direction approved for spike
### A. Background Service Worker
Vai trò:
- owner của session state orchestration
- owner của action journal / dedup logic
- owner của lease coordination
- điểm điều phối giữa UI / content script / provider-side execution

### B. Content Script / in-page adapter layer
Vai trò:
- đọc DOM/provider state
- fill prompt
- send prompt
- detect response arrival / visible commit evidence
- phát event/ack/error theo IPC contract

### C. Session model
Mỗi phiên runtime phải có:
- `session_id`
- version/phase marker
- owner / lease state
- active action state
- checkpoint / recovery metadata

### D. Side-effect boundary
Các action có hậu quả phải được xem là action nghiệp vụ riêng, không chỉ là function call UI:
- `auto_send`
- `handoff`
- `finalize`
- `export`

---

## Risk-tiered action model
### R0 — Internal no-side-effect
Ví dụ:
- metrics
- quality scoring
- estimate calculations
- UI status updates

Policy:
- auto by default

### R1 — Internal recoverable state mutation
Ví dụ:
- checkpoint state
- update unresolved issues
- update artifact state
- phase transitions without external side effect

Policy:
- auto if versioned and logged

### R2 — Provider/runtime flow actions
Ví dụ:
- send prompt to provider
- trigger handoff
- switch runtime flow
- spawn judge pass

Policy:
- auto only when operator policy allows and runtime gate is healthy

### R3 — High-consequence actions
Ví dụ:
- finalize
- official export
- final send
- any action that cannot be assumed harmless

Policy:
- must be gated harder
- not approved for blind full automation at current maturity

---

## IPC Message Contract — mandatory next artifact
A formal IPC contract must exist before enabling high-consequence automation paths.

### Mandatory fields
- `protocol_version`
- `message_type`
- `session_id`
- `tab_id` or `actor_id`
- `action_id` for side-effecting actions
- `phase_version`
- `created_at`
- `payload`
- `expected_ack` where relevant
- `retry_count` where relevant
- `error_code` for failure events
- `correlation_id` strongly recommended as required

### Minimum message families
- `SESSION_REGISTER`
- `LEASE_ACQUIRE_REQUEST`
- `LEASE_ACQUIRED`
- `LEASE_CONFLICT`
- `LEASE_RENEW`
- `LEASE_RELEASE`
- `ACTION_REQUEST`
- `ACTION_ACK`
- `ACTION_COMMITTED`
- `ACTION_FAILED`
- `STATE_CHECKPOINT`
- `RESTORE_REQUEST`
- `RESTORE_BLOCKED`
- `FINALIZE_REQUEST`
- `FINALIZE_COMMITTED`
- `EMERGENCY_STOP`

### Mandatory invariants
- one `action_id` commits side effect at most once
- stale `phase_version` cannot mutate newer state
- side-effect action cannot blind-retry without commit-state knowledge
- finalize requires valid lease
- conflict must become explicit visible state or explicit policy path
- retry must be bounded and auditable

---

## Session-based Lease — mandatory next artifact
Lease scope must be per `session_id`, not a blind global mutex.

### Why
Without lease discipline:
- 2 tabs can manipulate one session at once
- finalize can race
- restart/takeover can replay unsafe action
- operator cannot know who owns the session

### Minimum lease states
- `unclaimed`
- `acquiring`
- `active`
- `renewing`
- `expired`
- `conflicted`
- `released`
- `takeover_pending`
- `blocked`

### Mandatory lease fields
- `session_id`
- `lease_owner_id`
- `lease_token`
- `lease_version`
- `acquired_at`
- `expires_at`
- `last_renewed_at`
- `current_phase`
- `active_action_id`
- `status`

### Mandatory behaviors
- second tab opening same session must not silently auto-run
- expired lease with unknown side-effect commit state must not auto-takeover blindly
- crash mid-side-effect must move to explicit unknown/review state
- finalize race must still be blocked by lease + dedup
- operator takeover must be explicit and audited

---

## Idempotency / Deduplication — mandatory next artifact
### Problem
`action_id` by itself is not enough unless commit protocol exists.

### Every side effect must have a dedup record
Minimum fields:
- `session_id`
- `action_id`
- `action_type`
- `payload_fingerprint`
- `phase_version`
- `status`
- `created_at`
- `committed_at`
- `commit_evidence`
- `last_error`
- `retry_policy`

### Required invariants
- `session_id + action_id` unique
- committed finalize cannot commit again
- same `auto_send` fingerprint in same phase commits at most once
- `unknown_commit_state` cannot auto-retry into new logical action
- retry must reference the same action record

### Mandatory action states
- `created`
- `acknowledged`
- `executing`
- `committed`
- `failed_before_commit`
- `unknown_commit_state`
- `blocked_for_review`
- `cancelled`

### Critical rule
If action enters `unknown_commit_state`, system must:
1. stop blind retry
2. avoid generating a new equivalent side-effect action
3. inspect commit evidence if supported
4. block for review if state cannot be proven

---

## Timeout / retry rules — mandatory next artifact
Retry policy must be action-class aware.

### Safe to retry more freely
- reads
- pure status checks
- idempotent checkpoint writes with stable identity
- lease renew/acquire with version guard

### Not safe for blind retry
- `auto_send`
- `finalize`
- `export`
- any provider-side effect where commit may already have happened

### Rule
No high-consequence side-effect may be retried automatically unless runtime can prove it did not commit.

---

## Implementation Spike policy
### Approved
- IPC contract draft + prototype
- lease state machine prototype
- action journal / dedup prototype
- mock/sandbox simulations
- restart / retry / multi-tab tests
- provider-real testing only under operator-visible control

### Not approved
- calling architecture frozen/production-ready
- default-on risky automation for real users
- full-close claims without evidence

### Spike safety rules
- all side-effect actions must log `action_id`
- all duplicate/retry/conflict outcomes must be observable
- finalization/export in spike must stay controlled
- spike result cannot be used as freeze proof without gate pass

---

## Gate to upgrade Candidate -> Baseline
Upgrade only when all are true:
1. IPC schema implemented and tested
2. lease state machine implemented and tested
3. dedup/action journal implemented and tested
4. restart/recovery path proven safe enough
5. side-effect safety policy implemented
6. blocker tests pass
7. operator-visible conflict/error/review states exist
8. documentation updated with implementation evidence

If any of the following remains true, Candidate cannot be promoted:
- auto-send can duplicate after retry/restart
- finalize can commit twice
- stale message can override newer state
- multi-tab conflict has no explicit policy
- takeover can occur while commit state is unknown
- tests not implemented or not passed
- critical security/operational blockers remain open

---

## Immediate next deliverables
1. `IPC_SCHEMA_V0_1.md`
2. `LEASE_STATE_MACHINE_V0_1.md`
3. `ACTION_JOURNAL_AND_DEDUP_V0_1.md`
4. `SPIKE_SAFETY_POLICY_V0_1.md`
5. `TEST_MATRIX_V0_1.md`
6. component diagram for Background / Content Script / adapters / state store / journal

---

## Practical conclusion
Use this document as the official architecture handoff for the next technical phase.

Canonical wording going forward:
- allowed now: `VS Brain Baseline Architecture V1.0 Candidate`
- not allowed yet: `VS Brain Baseline Architecture V1.0`, `Final`, `Frozen`, `Production-safe auto-finalize`

The correct next move is not more abstract debate.
The correct next move is implementation spike with evidence.
