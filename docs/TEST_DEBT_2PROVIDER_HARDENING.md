# VS Brain — Test Debt Checklist (2-Provider Hardening)

Saved: 2026-05-27 17:46 GMT+7
Scope: deferred real-user validation after current hardening wave
Owner for live validation: Adam
Runtime target: `apps/extension` from canonical source `projects/crosscritic`
Current hardened runtime: `v0.8.17`

## Why this file exists

Current implementation wave intentionally prioritized code-side hardening first:
- compact action layout
- hidden manual Save button
- auto-finalize to single Markdown file
- certification gate for `ChatGPT + Gemini`
- shortened dropdown labels
- finalize fallback readback
- input/dropdown UI cleanup

Live browser validation is intentionally deferred so the owner can test once in one consolidated pass.

## Test rule

Run all tests only after reloading the extension from canonical path:

`/home/phuong/.openclaw/workspace/projects/crosscritic/apps/extension`

Record each item as one of:
- `PASS`
- `FAIL`
- `PARTIAL`
- `NOT RUN`

For every non-pass item, attach:
- screenshot
- exact stop point
- expected vs actual
- whether issue is UI-only, runtime-only, or both

---

## Group A — UI sanity

### A1. Start area layout
- Expect 3 visible buttons only:
  - `Start`
  - `Stop`
  - `Handoff`
- Expect no visible `Save` button
- Expect layout:
  - row 1 = `Start | Stop`
  - row 2 = `Handoff` full width
Status: `NOT RUN`
Notes:

### A2. Input typography
- Check extra-instruction textarea font looks consistent with overall UI
- Check placeholder does not look too bold / too odd
Status: `NOT RUN`
Notes:

### A3. Dropdown truncation
- Source/target dropdown labels should truncate with `...`
- No ugly overflow or horizontal breakage
Status: `NOT RUN`
Notes:

### A4. Header / logo / spacing
- Logo visible
- No right-edge clipping
- Header spacing feels balanced
Status: `NOT RUN`
Notes:

---

## Group B — Core 2-provider runtime

### B1. Certified-provider scan
- Open tabs from ChatGPT + Gemini
- Expect both detected
- Expect unsupported providers not to enter production picker/loop
Status: `NOT RUN`
Notes:

### B2. Auto source/target pick
- Click `Start`
- Expect app auto-picks source/target without manual Save/finalize step
Status: `NOT RUN`
Notes:

### B3. Relay send path
- Prompt should relay from source to target
- Target should receive prompt cleanly
- Auto-send should work
Status: `NOT RUN`
Notes:

### B4. Counter reset
- On fresh Start, counter should reset to `0/100`
- Counter should increment correctly after loop starts
Status: `NOT RUN`
Notes:

### B5. Stop gate quality
- Loop should not stop too early
- Loop should stop on real agreement / max-step / valid runtime condition
Status: `NOT RUN`
Notes:

---

## Group C — Finalize / export hardening

### C1. Auto-finalize after non-manual stop
- If loop ends naturally, app should auto-send finalize prompt
- User should not need to click a Save button
Status: `NOT RUN`
Notes:

### C2. Markdown-only export
- Expect final download to be a single `.md` file
- No forced `.json`
- No forced `.gz` for final blueprint flow
Status: `NOT RUN`
Notes:

### C3. Max-step draft finalize
- Let loop end by max step without final agreement phrase
- Expect `draft_forced` style finalization flow to still produce `.md`
Status: `NOT RUN`
Notes:

### C4. Final response readback robustness
- If final response appears on candidate fallback tab, export should still succeed
- If not reproducible, mark `NOT RUN`
Status: `NOT RUN`
Notes:

---

## Group D — Drift / recovery behavior

### D1. Tab refresh mid-session
- Refresh one provider tab while loop is active
- Expect safe stop or safe recovery, not silent corruption
Status: `NOT RUN`
Notes:

### D2. Wrong-tab drift
- Switch active tab during run
- Expect intended target handling to remain stable
Status: `NOT RUN`
Notes:

### D3. Manual Stop behavior
- Click `Stop`
- Expect loop stop
- Expect no forced auto-finalize after manual stop
Status: `NOT RUN`
Notes:

### D4. Handoff visibility
- Handoff button still visible and usable
- No layout break from Save removal
Status: `NOT RUN`
Notes:

---

## One-pass summary block

Fill this after all live tests:

- Total PASS:
- Total FAIL:
- Total PARTIAL:
- Total NOT RUN:

### Priority bugs found
1.
2.
3.

### Recommended next action after owner test
- `ship current hardened 2-provider build`
- `patch UI only`
- `patch runtime only`
- `hold release and continue hardening`

## Notes for next engineering phase

Do not re-enable additional providers until:
1. this checklist is run once end-to-end
2. current 2-provider runtime is accepted
3. provider adapter certification checklist is written and adopted
