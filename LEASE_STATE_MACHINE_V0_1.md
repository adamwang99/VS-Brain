# VS Brain — Lease State Machine v0.1

## Status
Draft for implementation spike.

## Objective
Đảm bảo một `session_id` chỉ có một actor active đủ quyền điều phối side-effect tại một thời điểm.

## Scope
Lease khóa theo:
- `session_id`

Không dùng global mutex toàn extension làm primitive chính.

## Lease record
```json
{
  "session_id": "sess_xxx",
  "lease_owner_id": "popup:tab-123",
  "lease_token": "lease_xxx",
  "lease_version": 4,
  "status": "active",
  "current_phase": 7,
  "active_action_id": "act_xxx",
  "acquired_at": "...",
  "last_renewed_at": "...",
  "expires_at": "..."
}
```

## States
- `unclaimed`
- `acquiring`
- `active`
- `renewing`
- `expired`
- `conflicted`
- `released`
- `takeover_pending`
- `blocked`

## Events
- acquire request
- acquire granted
- acquire conflict
- renew tick
- expiry timeout
- release request
- takeover request
- takeover granted
- takeover blocked
- emergency stop
- unknown commit state detected

## Transition sketch
| From | Event | To | Rule |
|---|---|---|---|
| `unclaimed` | acquire request | `acquiring` | validate session |
| `acquiring` | acquire granted | `active` | token/version issued |
| `acquiring` | conflict | `conflicted` | another valid owner exists |
| `active` | renew tick | `renewing` | owner still alive |
| `renewing` | renew ok | `active` | expiry extended |
| `active` | expiry timeout | `expired` | owner silent |
| `expired` | takeover request | `takeover_pending` | only if commit state safe |
| `takeover_pending` | granted | `active` | new owner + new token/version |
| `takeover_pending` | blocked | `blocked` | commit state uncertain |
| `active` | release request | `released` | no unsafe inflight action |
| `active` | conflict detected | `conflicted` | competing owner or stale mismatch |
| any | emergency stop | `blocked` | freeze side effects |
| any | unknown commit state | `blocked` | fail closed |

## Ownership rules
1. Only `lease_owner_id` with matching `lease_token` may issue R2/R3 side-effect actions.
2. Renew extends lease only when token + version still current.
3. New acquire on active session returns conflict or read-only path.
4. Takeover cannot proceed while active side effect is `unknown_commit_state`.

## Takeover policy
Takeover allowed when:
- old lease expired
- no active side effect in uncertain state
- checkpoint/recovery data consistent enough

Takeover blocked when:
- finalize status unknown
- auto-send status unknown
- competing owner still renewing
- stale phase mismatch unresolved

## UI obligations
When state = `conflicted` or `blocked`, operator must see:
- session currently locked
- reason lock cannot proceed
- option: wait / inspect / explicit takeover if policy allows

## Hard invariants
1. Two actors must never both hold `active` lease for same `session_id`.
2. Lease expiry alone does not prove safe replay of side effect.
3. Takeover after unknown commit state must fail closed.
4. Finalize without valid active lease is invalid.
