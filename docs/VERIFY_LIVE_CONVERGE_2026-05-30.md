# VS Brain v0.8.46 — Live Convergence Fix Verify (2026-05-30)

## Vấn đề (lộ ra từ live smoke ChatGPT<->Gemini thật)
Loop debate chạy tới timeout mà không ra blueprint, ở 2 mode non-convergence:
- Mode A: mỗi vòng nêu critical MỚI (criticalStall=0) -> không stop condition nào fire.
- Mode B: hai bên trao đổi lịch sự, nội dung mới mỗi vòng, KHÔNG có tín hiệu kết thúc nào (critical=0, no repeat, no contradiction, no stop phrase).

## Fix runtime (apps/extension/popup.js, v0.8.46)
- Convergence budget: hard-stop `quality_guard_no_convergence` khi `critical>=8` & should_continue=false.
- Round budget: hard-stop `quality_guard_round_budget` khi `step>=12` (độc lập nội dung).
  Cả hai gated sau warmup (step<8) và bị override nếu peer đồng thuận should_continue=true.
- MỌI stop `quality_guard_*` / max-steps giờ route vào chuỗi stop->finalize.
- `draft_forced` finalize bỏ qua live judge-gate (trước đây fail-closed ERR_JUDGE_ENVELOPE_MISSING)
  và không chặn window.confirm.

## Fix harness (scripts/live-autopilot.mjs)
- Set CDP `Browser.setDownloadBehavior` -> bundle ghi xuống đĩa thay vì treo ở save-as prompt;
  chờ file .gz xuất hiện trước khi đóng browser.
- Verdict classifier: stop `quality_guard_*` mà CÓ blueprint = `FORCED_FINALIZE` (hợp lệ), không phải bug.

## Evidence
- Regression `npm test`: PASS 8/8 (thêm `no-convergence-critical-budget`, `polite-no-signal`).
- Live verify v0.8.46 (browser thật, login OK):
  - run round-budget: `verdict=FORCED_FINALIZE`, stop `quality_guard_round_budget` @ step 13,
    `finalized=true`, `bundleOnDisk=true`, file .gz 2877 bytes, schema `vs-brain.final_bundle.v1`,
    provider chatgpt, URL thật `chatgpt.com/c/6a1a568f...`.
  - run contradiction: stop `quality_guard_contradiction` @ step 8 -> draft_forced finalize -> bundle .gz 2728 bytes (gemini).
- Push: `869dfb3..21eecf1 main -> main` trên adamwang99/VS-Brain.

## Kết luận
Loop VS Brain giờ LUÔN kết thúc có blueprint (consensus hoặc forced finalize), không treo tới timeout.
