# VS Brain Lab

## Mục tiêu
Tạo môi trường deterministic để test logic VS Brain mà không phụ thuộc provider thật.

## Thành phần hiện có
- `lab/mock-chatgpt.html`
- `lab/mock-gemini.html`
- `lab/mock-provider.js`
- `lab/chrome-shim.js`
- `lab/popup-lab.html`
- `lab/scenarios/dual-consensus.json`
- `lab/scenarios/continue-vs-stop.json`
- `lab/scenarios/finalize-blueprint.json`
- `lab/scenarios/stale-stop-reason.json`

## Cách chạy local nhanh
Từ repo `projects/crosscritic` chạy static server cho lab shell:

```bash
python3 -m http.server 4175
```

Mở shell:
- `http://127.0.0.1:4175/lab/popup-lab.html`

Hoặc mở mock page riêng lẻ:
- `http://127.0.0.1:4175/lab/mock-chatgpt.html?scenario=/lab/scenarios/dual-consensus.json`
- `http://127.0.0.1:4175/lab/mock-gemini.html?scenario=/lab/scenarios/dual-consensus.json`

## Load extension
- Mở `chrome://extensions`
- bật `Developer mode`
- `Load unpacked`
- chọn `projects/crosscritic/apps/extension`

## Regression runner
Chạy regression deterministic 3 case bằng Chrome + Xvfb:

```bash
xvfb-run -a node tests/e2e/popup-lab-regression.mjs
```

Expected output:
- `dual-consensus/save PASS`
- `continue-vs-stop PASS`
- `stale-stop-reason PASS`

## Trạng thái hiện tại
Lab đã pass 3 nhóm lỗi cứng:
1. dual-consensus → tự dừng + Save + auto download
2. continue-vs-stop → không dừng non khi còn `should_continue:true`
3. stale stop reason → không ép draft finalize giả

## Mục tiêu phase tiếp theo
1. verify live-provider path
2. chỉ vá integration-only nếu live path lệch lab
3. giữ regression runner làm gate chống tái phát

## Ghi chú
Hiện mock page ưu tiên tương thích selector scan cơ bản:
- `data-message-author-role`
- `.markdown`
- textarea + button send

Lab mode đã được cắm cho `http://127.0.0.1/*` và route mock:
- `/lab/mock-chatgpt.html` → provider `chatgpt`
- `/lab/mock-gemini.html` → provider `gemini`
