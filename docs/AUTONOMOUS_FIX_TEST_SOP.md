# SOP — VS Brain Autonomous Fix → Test Loop (no-ask, run-to-completion)

Mục tiêu: theo dõi app chạy, đợi dừng, lấy info, phân tích, nếu lỗi thì tự fix, tự chạy lại, lặp tới khi xong. Không hỏi Sếp giữa chừng. Tuân 3 chữ gốc EVO-CORE: Siêu nhẹ - Bất biến - Tự trị.

## 0. Done definition (điều kiện DỪNG vòng lặp)
Vòng tự trị được coi là XONG khi đạt đủ:
1. `npm test` (regression mock) PASS toàn bộ scenario, 2 lần liên tiếp không correction.
2. Ít nhất 1 run LIVE thật (ChatGPT ↔ Gemini) kết thúc bằng consensus thật
   (stop reason chứa `cả 2 tab đã chốt` / `CHỐT_ĐỒNG_THUẬN`), KHÔNG phải
   `quality_guard_*`, `auto_handoff_failed`, `state_invalid_*`, timeout.
3. Bản đang chạy live = bản đã fix (version khớp `apps/extension/manifest.json`).

Chừng nào chưa đủ 3 → vòng còn mở, không báo "đã xong".

## 1. Nguồn quan sát (ground truth, cấm giả định)
- Regression deterministic: `npm test` (mock provider, headless qua xvfb). Đây là tầng test tự trị 100%.
- Live session export: `~/Downloads/vs-brain/<session>/debug-log-*.txt`.
  - Mỗi run live finalize/export sinh 1 thư mục + debug-log.
  - Stop reason = dòng `auto-loop stopped: ...`.
  - Version chạy = dòng `runtime version: vX.Y.Z`.
- Code source-of-truth: `apps/extension/popup.js` (+ runtime helpers). Chrome load unpacked từ đây nhưng CHỈ cập nhật sau khi reload extension.

## 2. Vòng lặp (driver = `scripts/vsbrain-autofix-loop.mjs`)
```
iteration:
  1. npm test (regression)
  2. PASS? -> sang bước live check
  3. FAIL -> đọc artifact failing scenario -> diagnose root cause
            -> sửa code tối thiểu (surgical) -> quay lại bước 1
  4. live: chạy watcher (scripts/watch-live-sessions.mjs)
            - không có session bug mới -> chờ run live tiếp theo
            - có session bug mới -> classify -> fix code -> npm test -> lặp
```
Trần lặp an toàn: 8 iteration/lần phát động. Quá 8 mà chưa converge = blocker cứng, dừng + báo root cause (đây là 1 trong 2 trường hợp được phép cắt run-to-completion).

## 3. Quy tắc fix
- Sửa tối thiểu, đúng root cause, không refactor cơ hội.
- Mỗi fix phải có regression scenario chứng minh (thêm vào `lab/scenarios/` + assertion trong `tests/e2e/popup-lab-regression.mjs`).
- Sau fix: bump `VS_BRAIN_VERSION` + marker + `manifest.json` version để phân biệt bản chạy.
- Không push thẳng main. Commit + push branch theo git_safety nếu cần lưu.

## 4. Giới hạn tự trị (boundary thật)
- Em KHÔNG tự reload extension trong Chrome live của Sếp và KHÔNG tự khởi động lại
  debate trên tab đã đăng nhập, trừ khi bật CDP (`--remote-debugging-port`) — việc này
  làm gián đoạn session đang chạy nên cần Sếp duyệt riêng.
- Vì vậy sau khi code xanh: 1 thao tác tay duy nhất của Sếp = reload extension ở
  `chrome://extensions` rồi chạy lại debate. Watcher sẽ tự bắt kết quả.

## 5. Exit gate cho cron watcher (bắt buộc theo AGENTS.md)
- Cron watcher là task-bound (gắn task "ổn định VS Brain live").
- Exit gate: tự disable khi phát hiện 1 session live kết thúc consensus thật
  (done definition mục 0.2), HOẶC TTL 12h, tuỳ cái nào tới trước.
- Khi disable phải announce lý do.

## 6. Cấm
- Cấm báo "đã xong" khi chưa đủ done definition.
- Cấm coi regression PASS = live ổn (2 tầng khác nhau).
- Cấm assume version đang chạy; phải đọc từ debug-log.
