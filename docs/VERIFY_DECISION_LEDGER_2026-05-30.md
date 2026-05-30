# VS Brain v0.8.47 — Output-Mode Selector + Decision Ledger Verify (2026-05-30)

## Vấn đề
Blueprint văn xuôi cố định không đủ cho power-user (ca audit chiến lược giao dịch nội bộ): cần bản
ghi quyết định neo bằng chứng, không phải khung chống chốt ẩu chung chung.
Gốc: VS Brain debate 1 dòng ý tưởng, output 1 schema cố định, không nuốt payload thật.

## Giải pháp (v0.8.47)
- Selector ở Start chọn dạng output:
  - Blueprint (nhanh) — mặc định, giữ nguyên hành vi cũ.
  - Decision Ledger (cần payload) — bắt buộc dán evidence payload.
- Ledger mode ràng buộc:
  - Start bị chặn nếu mode=ledger và payload rỗng.
  - Payload inject vào mọi relay turn qua `<<<EVIDENCE ... >>>`.
  - Finalize dùng golden schema Decision Ledger: executive verdict, decisions
    (evidence/counter_evidence/confidence/reverse_if/status), unsupported claims,
    open contradictions, next data to collect.
  - Claim không có payload support bị mark `status: unsupported`, không trình bày như decision.
- Loop core (relay, stop budgets, forced finalize) tái dùng nguyên; mode chỉ khác
  prompt template + payload, không đụng control flow. Bundle ghi `outputMode`.

## Evidence
- Regression `npm test`: PASS 9/9 (thêm `ledger-mode-evidence`: chứng minh payload
  inject vào relay turn + finalize dùng ledger schema).
- Live verify v0.8.47 (browser thật, payload audit nội bộ):
  - `verdict=FORCED_FINALIZE`, file bundle .gz 3673 bytes trên đĩa, URL thật chatgpt.com.
  - Ledger neo đúng số liệu trong payload, tự mark giá trị triển khai ngoài payload
    (ví dụ các ngưỡng deployment không được dữ liệu hỗ trợ) là `unsupported`.
- Push: `21eecf1..730c71c main -> main` trên adamwang99/VS-Brain.

## Giới hạn ghi nhận
- Run live này model điền `evidence`+`unsupported` đủ, nhưng `counter_evidence`/`confidence`
  điền thưa — độ sâu nội dung tuỳ model, không phải lỗi contract (schema prompt đã ép đủ field).

## Kết luận
VS Brain giờ là cỗ máy ra quyết định neo-bằng-chứng (không chỉ trọng tài tranh luận).
Sẵn sàng dùng cho các quyết định có tranh cãi: chạy ledger trên payload thật để chốt bằng evidence.
