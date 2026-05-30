# VS Brain — Test Matrix v0.1

## Status
Draft for implementation spike.

## Purpose
Block promotion from Candidate to Baseline unless concurrency, retry, idempotency, recovery, and UI conflict states pass.

## IPC tests
| ID | Case | Expected |
|---|---|---|
| IPC-01 | message missing `session_id` | reject, no state mutation |
| IPC-02 | stale `phase_version` | reject as stale |
| IPC-03 | missing ACK timeout | action enters timeout/blocked path |
| IPC-04 | retry idempotent read/checkpoint | no duplicate state |
| IPC-05 | incompatible protocol version | reject with `ERR_PROTOCOL_VERSION` |

## Action / side-effect tests
| ID | Case | Expected |
|---|---|---|
| ACT-01 | auto-send commit succeeds then ack lost | no duplicate send on retry |
| ACT-02 | auto-send crash before commit known | `unknown_commit_state`, no blind retry |
| ACT-03 | finalize requested twice | only one commit |
| ACT-04 | export retried | artifact versioning or duplicate block |
| ACT-05 | same payload fingerprint in same phase | second commit blocked |

## Lease tests
| ID | Case | Expected |
|---|---|---|
| LEASE-01 | two tabs acquire same session concurrently | one active lease only |
| LEASE-02 | owner crash before side effect | takeover allowed after validation |
| LEASE-03 | owner crash during auto-send | takeover blocked/review unless commit proven safe |
| LEASE-04 | lease expired with unknown finalize state | blocked |
| LEASE-05 | stale owner renews after takeover | renew rejected |

## Service worker / recovery tests
| ID | Case | Expected |
|---|---|---|
| SW-01 | service worker restart before ACK | no duplicate side effect |
| SW-02 | service worker restart after commit | commit recognized |
| SW-03 | restore stale checkpoint | reject or safe migration |
| SW-04 | resume same session in two tabs | conflict/read-only/takeover UI |

## Finalization / verdict tests
| ID | Case | Expected |
|---|---|---|
| FIN-01 | malformed termination envelope | no finalize |
| FIN-02 | wrong nonce | no finalize |
| FIN-03 | multiple envelopes | no finalize |
| FIN-04 | `should_continue=true` | no finalize |
| FIN-05 | judge timeout | no finalize |
| FIN-06 | judge veto | no finalize |

## Handoff estimator tests
| ID | Case | Expected |
|---|---|---|
| HANDOFF-01 | context usage exceeds threshold | handoff triggered |
| HANDOFF-02 | DOM estimate shrinks while local estimate grows | estimator unreliable |
| HANDOFF-03 | handoff tab creation fails | action failed/blocked, no blind continuation |
| HANDOFF-04 | bootstrap send unknown state | no blind retry |

## UI tests
| ID | Case | Expected |
|---|---|---|
| UX-01 | action blocked by unknown state | visible reason + operator path |
| UX-02 | lease conflict | visible conflict, no silent auto-loop |
| UX-03 | emergency stop during running action | safe stop/blocked state |
| UX-04 | safe-release auto-send default | OFF unless explicitly enabled |

## Promotion rule
Candidate cannot become Baseline until all blocker tests pass or are explicitly waived with owner-approved risk record.
