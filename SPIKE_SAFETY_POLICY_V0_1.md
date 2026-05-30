# VS Brain — Spike Safety Policy v0.1

## Status
Draft for implementation spike.

## Purpose
Cho phép implementation spike diễn ra nhanh nhưng không trượt thành pseudo-production không kiểm soát.

## Approved in spike
- IPC prototype
- lease prototype
- action journal / dedup prototype
- mock provider tests
- restart / retry / multi-tab simulations
- provider-real tests under explicit operator control

## Not approved in spike
- default-on risky automation for real-user sessions
- auto-finalize production claim
- production freeze claim
- hidden retry of side-effect actions after uncertain commit

## Safety rules
1. All side-effect actions must have `action_id`.
2. All side-effect actions must enter action journal before execution.
3. Any `unknown_commit_state` must block blind retry.
4. Finalize/export with real consequence must remain operator-controlled or sandboxed until gate pass.
5. Conflict/blocked states must be visible, not silent.
6. Crash/reload cannot silently resume risky actions without recovery validation.

## Real-provider rule
When spike touches real provider tabs:
- operator-visible state mandatory
- emergency stop visible and working
- auto-send should stay explicit
- no production-safe claim from spike result alone

## Exit conditions for spike
Spike can be called successful only if it produces:
- implementation evidence
- failure evidence
- updated candidate docs
- clear list of what still blocks Baseline promotion
