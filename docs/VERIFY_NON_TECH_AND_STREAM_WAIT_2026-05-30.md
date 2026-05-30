# VS Brain v0.8.49 + v0.8.50 — Non-tech Prompts + Stream Wait Verify (2026-05-30)

## Vấn đề (lộ ra từ live test 2 prompt non-technical)
Sếp đặt câu hỏi: blueprint mode hiện tại có usable cho user không-kỹ-thuật không (kinh doanh, học tập)?
Live test 2 ca trên v0.8.48 lộ 2 lỗi thật:
1. Critique prompt mặc định ép panel kỹ thuật (architect/security/UX) lên mọi topic. Ca quang hợp lệch sang "meta-loop UI artifacts"; ca cafe tone code-review.
2. `buildFinalMarkdown` tin "phản hồi cuối" của model = blueprint body. Khi forced stop fire, bundle save chỉ chứa câu cụt (1208B / 1730B), không phải báo cáo thật.

## Giải pháp 2 commit liên tiếp

### v0.8.49 — intent presets + finalize rewrite mandate
- Thêm Intent selector (Auto/Business/Learning/Tech-Code) trong Start. Mỗi preset swap critique prompt + finalize schema.
- Code preset giữ nguyên panel cũ + 8-section blueprint.
- Business → Decision Brief; Learning → Learning Brief; Auto → generic Final Brief.
- Finalize prompt MANDATE viết ≥600 từ từ đầu, không acknowledge agreement.
- Live retest cafe: critical=8 → critical=0 (tone không còn ép). Schema model bám đúng "Business Decision Brief / 1. Executive summary".
- Push: `9c7df60`.

### v0.8.50 — wait-for-stable-stream
- Live retest cafe v0.8.49 vẫn ra 1208 byte cụt — đoán prompt sai gốc.
- Root cause thật: `waitForTabNewResponseStandalone` return ngay khi hash đổi lần đầu → finalize extract giữa stream model.
- Fix: poll cho đến khi same-hash 3 lần liên tiếp HOẶC `isGenerating=false` từ page detector. Safety fallback 60s.
- Loop relay path không đụng (dùng waiter khác).
- Push: `95dcd78`.

## Evidence (live trước/sau, cùng prompt cùng login cùng máy)

| Ca | v0.8.48 (trước) | v0.8.50 (sau) | Δ |
|---|---|---|---|
| Cafe (business intent) | 1208 bytes, section 2 cụt giữa câu "Quận 1," | 8425 bytes, blueprint đủ 8 mục | ~7× |
| Quang hợp (learning intent) | 1730 bytes, debate lệch sang "UI artifacts/meta-loop" | 7466 bytes, Learning Brief đúng schema | ~4× |

Chi tiết content:
- Cafe v0.8.50: 2 kịch bản vốn (800tr → 40-60m2 hoặc giữ 200m2 cần ≥3 tỷ), unit economics (COGS 30-35%, gross margin ≥65%), 7-step rollout 90 ngày, KPI prime cost <45%.
- Quang hợp v0.8.50: Learning Brief đúng tone giáo viên — headline 1-2 câu HS lặp lại được, 3 giai đoạn (thu thập/vận hành/sản phẩm), thuật ngữ phù hợp lớp 8 (khí khổng, "diệp lục như tấm pin năng lượng mặt trời"). KHÔNG còn lệch UI-artifacts.

Cả 2 ca: `verdict=FORCED_FINALIZE`, `critical=0`, bundle .gz xuống đĩa thật.

## Regression (lab harness)
10/10 PASS sau cả 2 commit. Loop core (relay, stop budgets, forced finalize, ledger validator) không bị phá.

## Bài học
1. Output mode không chỉ là UI selector. Phải kéo theo (a) ràng buộc input, (b) ràng buộc schema output, (c) cơ chế thu artifact đúng tầng. Thiếu 1 = mode giả.
2. Khi fix có vẻ pass trên prompt nhưng output thật vẫn cụt, đừng patch tiếp prompt. Đi xuống tầng cơ chế thu (extract/wait gate) — đó mới là gốc.
3. "Wait until response changes" ≠ "wait until response complete". Stream-aware gate phải dùng hash-stable + isGenerating=false.

## Kết luận
VS Brain giờ usable cho người dùng không-kỹ-thuật. Intent + schema + wait-stable đủ contract để mode mới có răng. Code intent vẫn nguyên cho technical workflow cũ.
