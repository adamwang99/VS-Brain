# VS Brain — Owner Test Form (Short)

Saved: 2026-05-27 18:29 GMT+7
Purpose: ultra-short owner validation form before deeper follow-up

Reload from:
`/home/phuong/.openclaw/workspace/projects/crosscritic/apps/extension`

## 5 core checks

### 1. UI layout
- 3 visible buttons only: `Start`, `Stop`, `Handoff`
- no visible `Save`
- no ugly overflow/right-edge clipping
Result: `NOT RUN`
Notes:

### 2. Core loop
- ChatGPT + Gemini both recognized
- Start auto-picks source/target
- loop starts normally
Result: `NOT RUN`
Notes:

### 3. Counter / stop behavior
- start resets to `0/100`
- stop gate not obviously too early
Result: `NOT RUN`
Notes:

### 4. Finalize / export
- non-manual stop triggers auto-finalize
- final download is one `.md` file
Result: `NOT RUN`
Notes:

### 5. Manual stop / drift
- pressing `Stop` does not force auto-finalize
- no obvious tab drift corruption
Result: `NOT RUN`
Notes:

## One-line verdict

- overall: `PASS | FAIL | PARTIAL`
- next action:
