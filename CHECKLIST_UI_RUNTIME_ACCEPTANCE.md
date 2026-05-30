# VS Brain — UI + Runtime Acceptance Checklist

## Canonical source
- Reload extension from exactly:
  - `/home/phuong/.openclaw/workspace/projects/crosscritic/apps/extension`
- Do **not** test from demo/export/copy paths.

## A. UI wave check
PASS if all true:
- [ ] Logo mới hiển thị đúng
- [ ] Version hiển thị đúng wave hiện tại
- [ ] Có runtime strip / runtime pill ở phần đầu
- [ ] Action panel gọn, không phải layout cũ kéo dài
- [ ] Preset vòng hiển thị đủ:
  - [ ] `25`
  - [ ] `50`
  - [ ] `100`
  - [ ] `200`
  - [ ] `500`
  - [ ] `1000`
- [ ] `Steps` input cho nhập tới `1000`
- [ ] Slider support tới `1000`
- [ ] Không bị cắt mép phải / tràn ngang
- [ ] Archive có nút bundle export rõ ràng

## B. Core 2-provider loop
Precondition:
- [ ] Có đúng 2 tab AI cần test: `ChatGPT` + `Gemini`
- [ ] Ít nhất 1 tab nguồn đã có 1 câu trả lời assistant usable

PASS if all true:
- [ ] `Quét tab` thấy đủ 2 tab AI
- [ ] Auto-pick chọn source/target hợp lý
- [ ] `GPT -> Gemini` relay được
- [ ] `Gemini -> GPT` relay được
- [ ] Khi `Auto-send=ON`: auto-send hoạt động cả 2 chiều
- [ ] Khi `Auto-send=OFF`: auto-loop bị chặn rõ, không dán mù rồi nhảy vòng
- [ ] Counter chạy đúng, không lệch stale

## C. Stop / finalize discipline
PASS if all true:
- [ ] Không dừng non khi còn `should_continue: true`
- [ ] Chỉ chốt khi stop phrase nằm ở **dòng cuối cùng**
- [ ] `Save` / finalize không tin mù sourceTab cũ
- [ ] Finalize yêu cầu termination envelope hợp lệ
- [ ] Judge gate có thể veto/review trước export
- [ ] Finalize xuất bundle thành công

## D. Long-run guard stack
### D1. Quality guard
- [ ] Có log quality guard trong loop
- [ ] Có xử lý repeated / low-confidence / contradiction / critical blocker

### D2. Auto handoff
PASS if all true:
- [ ] Khi usage context cao, log có `auto-handoff triggered`
- [ ] Tạo artifact `.md`
- [ ] Tạo artifact `.json`
- [ ] Mở tab thay thế
- [ ] Gửi bootstrap prompt sang tab mới

### D3. Structured handoff state
- [ ] Handoff payload có schema `vs-brain.context_handoff.v1`
- [ ] Có `requirements`
- [ ] Có `decisions`
- [ ] Có `resolved_issues`
- [ ] Có `unresolved_issues`
- [ ] Có `next_critique_focus`

## E. Smoke commands
```bash
cd /home/phuong/.openclaw/workspace/projects/crosscritic
npm run test:vsbrain:autofix
npm run test:vsbrain:auto-handoff
```

## F. Current evidence baseline
- `test:vsbrain:autofix` -> `PASS_ALL`
- `test:vsbrain:auto-handoff` -> PASS with:
  - `auto-handoff triggered ... usage=84% threshold=70%`
  - bootstrap sent to replacement tab

## Fail immediately if
- [ ] UI vẫn chỉ có `25 / 50 / 100`
- [ ] Không có `1000`
- [ ] Đang load nhầm path demo/copy
- [ ] GPT hoặc Gemini không gửi được
- [ ] Auto handoff không nổ khi context cao
- [ ] Finalize dừng sai / stop phrase bị match mù
