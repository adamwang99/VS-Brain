# VS Brain — Git Boundary Hidden-State Fix Verify (2026-05-30)

## Vấn đề
Repo `adamwang99/VS-Brain` chỉ track 37 file. `popup.html` nạp 5 module qua thẻ
`<script>` nhưng cả 5 đều untracked, cùng toàn bộ lab harness + tests/e2e + docs.
Bản local chạy được nhưng repo không rebuild được từ clone sạch (vi phạm "Bất biến").

## Load-bearing untracked đã track lại
- apps/extension/action-journal.js
- apps/extension/ipc-runtime.js
- apps/extension/lease-runtime.js
- apps/extension/runtime-recovery.js
- apps/extension/judge-gate.js
- lab/popup-lab.html, lab/chrome-shim.js, lab/mock-provider.js, lab/mock-chatgpt.html, lab/mock-gemini.html
- lab/scenarios/{dual-consensus,continue-vs-stop,stale-stop-reason}.json
- tests/e2e/* (35 file), docs/* , package-lock.json, playwright.config.mjs

## Fix
- Commit `869dfb3` — track 89 file load-bearing + gitignore scratch checkpoint theo ngày.
- Push `9777d7a..869dfb3 main -> main`.

## Evidence (clean clone rebuild)
- `git clone` repo sạch → 125 tracked files.
- 5 module load-bearing + toàn bộ lab harness + 6 scenario có mặt trong clone.
- `npm install --ignore-scripts` rc=0.
- `npm test` từ clean clone: PASS 6/6
  - dual-consensus/save PASS
  - continue-vs-stop PASS
  - stale-stop-reason PASS
  - continue-contradiction-veto PASS
  - duplicate-source-stall PASS
  - critical-but-progressing PASS
- `git ls-remote origin main` = 869dfb3 (push confirmed).

## Kết luận
Repo bất biến: rebuild được từ con số 0. Hidden-state git boundary đã đóng.
