# VS Brain — IPC Schema v0.1

## Status
Draft for implementation spike.

## Purpose
Định nghĩa hợp đồng message giữa popup/background/content-script để:
- chống stale message
- theo dõi ack/commit/fail
- hỗ trợ retry có kiểm soát
- làm nền cho lease + dedup

## Core principles
1. Mọi message phải thuộc đúng `session_id`.
2. Mọi action có side effect phải có `action_id`.
3. Mọi mutation quan trọng phải gắn `phase_version`.
4. Message cũ không được ghi đè state mới.
5. Không blind-retry side effect khi chưa rõ commit state.

## Envelope
```json
{
  "protocol_version": "vsbrain.ipc.v0.1",
  "message_type": "ACTION_REQUEST",
  "session_id": "sess_xxx",
  "actor_id": "popup:tab-123|bg|cs:tab-456",
  "tab_id": 123,
  "action_id": "act_xxx",
  "phase_version": 7,
  "correlation_id": "corr_xxx",
  "created_at": "2026-05-28T04:00:00.000Z",
  "expected_ack": true,
  "retry_count": 0,
  "payload": {},
  "error_code": null
}
```

## Required fields
| Field | Required | Notes |
|---|---:|---|
| `protocol_version` | yes | Fixed string for parser contract |
| `message_type` | yes | Command/event/ack/error type |
| `session_id` | yes | Runtime session key |
| `actor_id` | yes | Sender identity |
| `tab_id` | conditional | Required when tab-scoped |
| `action_id` | side effects | Required for side-effecting actions |
| `phase_version` | yes | Reject stale mutation |
| `correlation_id` | yes | Request-response matching |
| `created_at` | yes | ISO timestamp |
| `expected_ack` | command | Needed for ack path |
| `retry_count` | retryable | Increment per resend |
| `payload` | conditional | Type-specific body |
| `error_code` | error | Stable machine code |

## Message families
### Session
- `SESSION_REGISTER`
- `SESSION_HEARTBEAT`
- `SESSION_CLOSED`

### Lease
- `LEASE_ACQUIRE_REQUEST`
- `LEASE_ACQUIRED`
- `LEASE_CONFLICT`
- `LEASE_RENEW`
- `LEASE_RELEASE`
- `LEASE_EXPIRED`
- `LEASE_TAKEOVER_REQUEST`
- `LEASE_TAKEOVER_GRANTED`
- `LEASE_TAKEOVER_BLOCKED`

### Actions
- `ACTION_REQUEST`
- `ACTION_ACK`
- `ACTION_EXECUTING`
- `ACTION_COMMITTED`
- `ACTION_FAILED`
- `ACTION_BLOCKED`
- `ACTION_CANCELLED`

### State / recovery
- `STATE_CHECKPOINT`
- `STATE_RESTORED`
- `RESTORE_REQUEST`
- `RESTORE_BLOCKED`
- `EMERGENCY_STOP`

### Finalization
- `FINALIZE_REQUEST`
- `FINALIZE_READY`
- `FINALIZE_BLOCKED`
- `FINALIZE_COMMITTED`

## Payload schemas
### `LEASE_ACQUIRE_REQUEST`
```json
{
  "reason": "start_loop|resume|takeover",
  "requested_by": "popup",
  "requested_phase": 7
}
```

### `ACTION_REQUEST`
```json
{
  "action_type": "auto_send|handoff|finalize|export|judge",
  "payload_fingerprint": "sha256:...",
  "target": {
    "provider": "chatgpt|gemini",
    "tab_id": 123
  },
  "parameters": {}
}
```

### `ACTION_COMMITTED`
```json
{
  "action_type": "auto_send|handoff|finalize|export|judge",
  "commit_evidence": {
    "kind": "dom_marker|download_started|artifact_written|provider_ack",
    "value": "..."
  }
}
```

### `ACTION_FAILED`
```json
{
  "action_type": "auto_send|handoff|finalize|export|judge",
  "failure_stage": "before_commit|unknown_commit_state|after_commit_followup",
  "retry_allowed": false,
  "message": "human-readable"
}
```

## Stale-message rules
Reject mutation when:
- `phase_version` < current session phase
- `protocol_version` incompatible
- `session_id` not found
- `lease_token` absent/invalid for lease-bound action

## Ack rules
- `ACTION_REQUEST` with `expected_ack=true` must receive `ACTION_ACK`
- side-effect path should progress:
  - `ACTION_REQUEST`
  - `ACTION_ACK`
  - `ACTION_EXECUTING`
  - `ACTION_COMMITTED` or `ACTION_FAILED`
- missing ack by timeout => command enters timeout policy, not blind resend

## Error codes
- `ERR_PROTOCOL_VERSION`
- `ERR_STALE_PHASE`
- `ERR_LEASE_REQUIRED`
- `ERR_LEASE_CONFLICT`
- `ERR_UNKNOWN_SESSION`
- `ERR_DUPLICATE_ACTION`
- `ERR_UNKNOWN_COMMIT_STATE`
- `ERR_PROVIDER_ADAPTER`
- `ERR_FINALIZE_BLOCKED`
- `ERR_RECOVERY_BLOCKED`

## Hard invariants
1. One logical `action_id` may commit side effect at most once.
2. No stale `phase_version` may mutate current state.
3. Finalize requires valid lease + non-stale phase.
4. Retry must reference same `action_id`, never create hidden new logical action.
5. `unknown_commit_state` blocks automatic resend/finalize replay.
