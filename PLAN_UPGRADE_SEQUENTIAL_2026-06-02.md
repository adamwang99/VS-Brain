# VS Brain — Kế hoạch nâng cấp tuần tự SOP Auto (2026-06-02)

## Mục tiêu

Nâng VS Brain từ v0.8.67 (demo kỹ thuật, 134KB monolithic) lên bản có tier Pro/Free, provider selection, payment, module hóa — theo từng step, mỗi step có test check loop: `sửa → test → verify → gate pass → next`.

**Nguyên tắc SOP Auto:** Mỗi bước làm xong tự verify, tự chạy test, tự quyết định pass/fail, cấm merge step hoặc skip test.

---

## Trạng thái nền (baseline)

| Tham số | Giá trị |
|---|---|
| Version | `v0.8.67-judge-advisory-no-faildownload` |
| Stable snapshot | `crosscritic-stable/vs-brain-0.8.67-stable-20260601-2244` |
| Source | `projects/crosscritic/apps/extension` |
| popup.js | 134KB, 1 line, ~100 functions, ~378 declarations, no modules |
| Lab test | 12/12 PASS (`npm run test:vsbrain:regression`) |
| Verify | `verify:all` PASS_ALL |
| Runtime | pairwise relay `ChatGPT ↔ Gemini` |
| Judge | Advisory-only, không blocking |
| Termination | Dual-consensus (`OK_DUAL_CONSENSUS`) là gate thật |

---

## Step 0 — Stabilize baseline + snapshot (P0 — bắt buộc đầu tiên)

### Input
- Live source `projects/crosscritic` đang ở commit `2050059`
- Stable snapshot ở `crosscritic-stable/vs-brain-0.8.67-stable-20260601-2244`

### Action
1. Commit tất cả uncommitted changes trong `crosscritic` (nếu có)
2. Tag `v0.8.67-stable-gate` làm mốc trước upgrade
3. Xác nhận stable snapshot = byte-identical với live source (`verify:all`)
4. Git push lên `adamwang99/VS-Brain`

### Test loop
```bash
npm run verify:all          # PASS_ALL — byte-identical check
npm run test:vsbrain:regression  # 12/12 PASS — lab regression
npm run build:full          # PASS — full export reproducible
```

### Gate
- `verify:all` PASS_ALL
- `test:vsbrain:regression` 12/12 PASS
- `git status` clean trên `crosscritic`
- Không có file dirty ngoài `PLAN_UPGRADE_SEQUENTIAL_2026-06-02.md`

### Output artifact
- Git tag `v0.8.67-stable-gate`
- Commit bất kỳ uncommitted change

---

## Step 1 — Module hóa popup.js: tách file (P0 — bắt buộc trước mọi feature)

### Input
- `popup.js` 134KB monolithic, 1 line
- `popup.html` references 1 script only

### Action
Tách popup.js thành các module file riêng (no bundler, dùng script tags):

| File | Chức năng | ~size (KB) |
|---|---|---|
| `core.js` | Constants, version, log(), setStatus(), $, qs, qsa | 3 |
| `i18n.js` | I18N object, applyUiLang(), getLang(), setLang() | 8 |
| `storage.js` | chrome.storage.local/sync, get/setCheckpoint, persistLoopCheckpoint, loadLoopCheckpoint | 5 |
| `tabs.js` | activeTab(), scanTabs(), aiTabs, executeInAiTab(), runInPage(), resolveArchiveScanTabId() | 8 |
| `providers.js` | AI_HOSTS, providerFromUrl(), provider detection, extractLatestResponse, fillPrompt, clickSend, pageScanner, + copy của page-helpers.js logic | 15 |
| `relay.js` | executeRelay(), autoPickDirection(), buildCritiquePrompt(), swap source↔target, quality guard, stall detection, convergence | 35 |
| `finalize.js` | finalize(), buildFinalMarkdown(), buildFinalJson(), downloadBundleZip(), recovery short-circuit, deterministic gate | 25 |
| `archive.js` | Export buttons, archive scan, checkpoint logic, handoff | 10 |
| `ui.js` | UI bindings, glass-select, intent dropdown, start/stop/save/handoff buttons, tab selection, loop counter | 20 |
| `ui-advanced.js` | Manual/custom panel, archive panel, log/debug panel, help modal | 5 |

Tổng: 134KB → ~134KB (cùng code, chỉ tách file)

### Manifest update
```json
"web_accessible_resources": [
  { "resources": ["core.js", "i18n.js", ...], "matches": [...] }
]
```

popup.html chuyển từ `<script src="popup.js">` sang load tuần tự các module qua <script> tags.

### Đảm bảo function visibility
Vì không dùng ES modules, dùng IIFE wrapper expose global `vs` object:
```js
// core.js
(function(global) {
  var VS = global.VS_BRAIN || {};
  function log(t) { ... }
  VS.log = log;
  global.VS_BRAIN = VS;
})(window);
```

### Test loop
```bash
# Step 1a: Verify syntax
node --check apps/extension/core.js
node --check apps/extension/i18n.js
... (từng file)
# Step 1b: Verify lab regression
npm run test:vsbrain:regression  # 12/12 PASS
# Step 1c: Verify full export wiring
npm run verify:all                # PASS_ALL
# Step 1d: Manual smoke — load extension, open lab, run 1 loop
```

### Gate
- Từng file pass `node --check`
- `test:vsbrain:regression` 12/12 PASS (identical output với baseline)
- `verify:all` PASS_ALL
- popup.js gốc renamed → `popup.js.bak-step1` (không xóa)
- Live smoke: extension load được, UI render đúng

### Output artifact
- `apps/extension/js/core.js`, `js/i18n.js`, ... (thư mục `js/`)
- `popup.html` updated với multi-script tags
- `popup.js.bak-step1` (backup)

---

## Step 2 — Implement termination envelope protocol thật (P0 — safety nền)

### Input
- Blueprint canonical section 8 mô tả envelope protocol
- Hiện tại: `termination_envelope.status = "confirmed_no_envelope"` — không có thật
- Gate thật là `OK_DUAL_CONSENSUS` (stop phrase trên 2 tab)

### Action
1. Thêm parser `parseTerminationEnvelope(text)` vào `finalize.js`:
   - Regex match ` ```vsbrain-termination ... ``` `
   - JSON parse
   - Verify: `status` = "ready_to_finalize"
   - Verify: `should_continue` = false
   - Verify: `critical_remaining` = false
   - Verify: `session_nonce` khớp finalize nonce
2. Thêm nonce lifecycle: tạo nonce khi loop start, dùng lại cho finalize
3. Finalize gate: envelope PASS + dual-consensus = confirmed
4. Envelope PASS + no dual-consensus = draft_forced (đúng rate)
5. Envelope FAIL + dual-consensus = confirmed (fallback — backwards compat)
6. Envelope FAIL + no dual-consensus = no finalize (ask operator)

### Test loop
```bash
# Unit test: input có envelope → parse đúng
# Unit test: input không có envelope → parse fail
# Unit test: input có 2 envelope → reject multiple
# Unit test: nonce không khớp → reject
# Lab regression with new scenario
npm run test:vsbrain:regression  # 13/13 PASS (new test: termination-envelope-parse)
```

### Gate
- Unit test envelope parser 5/5 PASS
- Lab regression 13/13 PASS
- Live smoke: run 1 loop với finalize, verify bundle JSON chứa `termination_envelope.status != "confirmed_no_envelope"`

### Output artifact
- `finalize.js` updated với envelope parser
- Test scenario mới: `termination-envelope-parse`

---

## Step 3 — Settings layer (chrome.storage.sync) — (P1)

### Input
- Hiện tại mọi threshold hardcoded (handoff 70%, budget 20/40, maxSteps=100)
- Không có settings panel

### Action
1. Tạo `settings.js` module:
   - `getSetting(key)` — đọc từ chrome.storage.sync với default
   - `setSetting(key, value)` — ghi
   - Defaults map:
     ```js
     DEFAULTS = {
       max_steps: 100,
       auto_send: true,
       auto_handoff: true,
       handoff_threshold_pct: 70,
       convergence_critical_budget: 20,
       round_budget: 40,
       language: 'vi',
       intent: 'auto',
       output_mode: 'blueprint',
       stop_phrase: 'CHỐT_ĐỒNG_THUẬN_HOÀN_TOÀN'
     }
     ```
2. Refactor `relay.js` và `finalize.js` — dùng `getSetting()` thay hardcoded constants
3. Settings UI: panel nhỏ trong "Advanced" section, input fields cho các threshold
4. Reset-to-default button

### Test loop
```bash
npm run test:vsbrain:regression  # vẫn 13/13 PASS (defaults không thay đổi behavior)
# Unit test: getSetting trả default khi chưa set
# Unit test: setSetting → getSetting trả giá trị mới
# Manual: mở settings panel → đổi threshold → verify loop dùng giá trị mới
```

### Gate
- Lab regression pass (behavior không đổi với defaults)
- Settings UI render đúng
- Thay đổi 1 setting → loop behavior thay đổi tương ứng

### Output artifact
- `settings.js`
- Settings panel HTML trong popup.html
- Tất cả hardcoded constants trong relay/finalize thay bằng `getSetting()`

---

## Step 4 — Provider registry + selection UI (P1)

### Input
- Hiện tại: 2 dropdown <select> source/target, chỉ pairwise
- Không có khái niệm "active participants"
- `provider-registry.js` 57 lines, mới chỉ là skeleton

### Action
1. Mở rộng `provider-registry.js` thành registry thật:
   ```js
   PROVIDERS = [
     { id: 'chatgpt', name: 'ChatGPT', icon: 'icons/chatgpt-16.png',
       urlPattern: 'chatgpt.com', certified: true },
     { id: 'gemini', name: 'Gemini', icon: 'icons/gemini-16.png',
       urlPattern: 'gemini.google.com', certified: true },
     { id: 'claude', name: 'Claude', icon: 'icons/claude-16.png',
       urlPattern: 'claude.ai', certified: false },
     { id: 'deepseek', name: 'DeepSeek', icon: 'icons/deepseek-16.png',
       urlPattern: 'chat.deepseek.com', certified: false },
     { id: 'grok', name: 'Grok', icon: 'icons/grok-16.png',
       urlPattern: 'x.com/i/grok', certified: false },
     { id: 'perplexity', name: 'Perplexity', icon: 'icons/perplexity-16.png',
       urlPattern: 'perplexity.ai', certified: false },
   ]
   ```
2. Provider selection UI: hàng logo ngang, click toggle on/off
3. Active provider state persist trong loopState
4. `scanTabs()` — chỉ hiện tab của provider được chọn
5. `autoPickDirection()` — chọn từ active providers thay vì tất cả AI tabs
6. Manifest update: thêm permissions cho URL patterns của provider mới

### Test loop
```bash
# Unit: providerFromUrl match đúng 6 provider
# Unit: scanTabs lọc đúng theo active providers
# Lab regression: 13/13 PASS (chatgpt+gemini vẫn là default)
npm run test:vsbrain:regression
# Verify: extension CSP không lỗi với provider URLs mới
```

### Gate
- Provider UI render đúng (6 logo, click toggle)
- `providerFromUrl` đúng cho 6 provider
- Lab regression không regression
- Extension load được với permissions mới

### Output artifact
- `provider-registry.js` mở rộng
- Provider icons (thêm 4 icons mới)
- `manifest.json` updated với permissions mới
- Provider selection UI trong popup.html

---

## Step 5 — Free/Pro tier + quota (P2)

### Input
- BLUEPRINT v0.8.68 đã chốt Free/Pro spec
- Chưa có gì về quota, tier, limit

### Action
1. Tạo `tier.js` module:
   - `getTier()` → `'free' | 'pro'`
   - `getQuota()` → `{ maxRounds: 50, maxProviders: 2, canExportFinal: false }` (free)
   - `setTier(tier)` — persist (chrome.storage.sync)
2. Tạo `quota.js` module:
   - `getRoundCount(sessionId)` — đọc số vòng đã dùng
   - `incrementRound(sessionId)` — tăng sau mỗi vòng
   - `isQuotaExceeded()` — kiểm tra hết chưa
   - Quota persist qua reload (dùng chrome.storage.local)
3. Relay loop kiểm tra quota trước mỗi vòng — nếu hết → dừng + CTA
4. Provider selection bị lock nếu vượt ngoài limit (Free = 2)
5. Finalize: Free chỉ export draft nếu chưa hội tụ; đã hội tụ + trong limit → final
6. UI indicator: hiển thị vòng còn lại / "Pro" badge
7. CTA banner: khi hết vòng → "Nâng cấp Pro để tiếp tục"

### Test loop
```bash
# Unit: getQuota('free') trả { maxRounds: 50, maxProviders: 2 }
# Unit: incrementRound → roundCount tăng
# Unit: isQuotaExceeded sau 50 rounds → true
# Lab regression: vẫn pass với tier free (mock chưa vượt 50)
npm run test:vsbrain:regression
# Manual: chạy loop 50 vòng → verify dừng + hiện CTA
```

### Gate
- Quota persist qua extension reload
- Free limit 50 rounds + 2 providers enforced
- Pro không có limit round (internal cap 100 + auto-continue)
- CTA hiện khi hết vòng

### Output artifact
- `tier.js`
- `quota.js`
- Tier + quota UI indicators trong popup.html

---

## Step 6 — Multi-provider relay: 3-way roundtable (P2)

### Input
- Relay engine hiện chỉ pairwise (2 tab)
- Pro cần 3 provider active

### Action
1. Refactor `relay.js`:
   - `loopState.participants = [tab1, tab2, tab3]` thay vì `source/target`
   - 3-way roundtable: A→B, B→C, C→A (mỗi vòng 2 query thay vì 1)
   - Stop phrase detection: cần 3/3 tab (Pro) hoặc 2/3 (fallback với threshold)
   - Round counter: 1 round = 3 participant pairwise queries
2. Free lane: participants max 2 → pairwise như cũ
3. Pro lane: participants max 3 → roundtable
4. UI: hiển thị active participants dạng flow A → B → C
5. Convergence rule: 
   - Free (2-party): dual-consensus (cũ)
   - Pro (3-party): majority-consensus (≥2/3 + stop phrase trên ít nhất 2 tab)

### Test loop
```bash
# Lab regression: 2-party (free tier) vẫn pass 13/13
npm run test:vsbrain:regression
# New lab scenario: 3-party mock (3 lab tabs), assert majority consensus
# Manual smoke: mở 3 tab AI (ChatGPT, Gemini, Claude), chạy loop
```

### Gate
- Pairwise (2-party) không regression
- 3-party roundtable chạy được
- Majority-consensus (≥2/3) logic đúng
- UI render flow A→B→C

### Output artifact
- `relay.js` refactored với multi-participant support
- New test scenario: roundtable-3-party

---

## Step 7 — Provider expansion: certified x 6 (P2)

### Input
- 4 provider candidate chưa có DOM scraper + fill/send logic
- Mỗi provider cần logic extract/fill/send/detect riêng

### Action
Thêm support cho từng provider:

| Provider | URL pattern | DOM selector (extract) | fill method | send method |
|---|---|---|---|---|
| Claude | claude.ai | `[class*="message"]` | contenteditable div | Enter/keypress |
| DeepSeek | chat.deepseek.com | `[class*="message"]` | textarea | button click |
| Grok | x.com/i/grok | chat messages | textarea | Enter |
| Perplexity | perplexity.ai | chat messages | textarea | button click |

1. `page-helpers.js`: thêm extract/fill/send/detect cho từng provider
2. `provider-registry.js`: thêm URL pattern + selector metadata
3. Chrome Tabs API scoping: verify extension có quyền inject vào các host mới
4. `extractLatestResponseInPage()` — dispatch đúng provider-specific selector
5. `fillPromptInPage()` — dispatch đúng fill method
6. `clickSendInPage()` — dispatch đúng send method

### Test loop
```bash
# Provider test: từng provider extract được response
# Provider test: từng provider fill được prompt
# Provider test: từng provider detect đúng surface (home/conversation/signin)
# Lab regression: ChatGPT+Gemini vẫn pass
npm run test:vsbrain:regression
# Live smoke: mở real tab từng provider, verify scan thấy tab
```

### Gate
- 6 provider detect đúng qua URL
- ChatGPT+Gemini: không regression
- 2/4 provider mới extract/fill/send pass lab mock
- 2/4 provider mới extract pass live smoke

### Output artifact
- `page-helpers.js` mở rộng cho 4 provider
- `provider-registry.js` mở rộng
- `manifest.json` cập nhật host permissions
- Provider test log cho từng provider

---

## Step 8 — Handoff estimator hybrid (P3)

### Input
- Hiện tại chỉ có `usage_pct_est_dom` (DOM estimate)
- Blueprint yêu cầu hybrid estimator + unreliable state

### Action
1. Thêm `localLengthEstimate()` — đếm ký tự content từ extract response
2. So sánh DOM estimate với local estimate
3. Nếu lệch > 30% → `estimator_status = "unreliable"`
4. Khi unreliable: dừng auto-handoff, báo operator, cho manual fallback
5. Khi reliable: dùng max(dom, local) làm estimate
6. Thêm safety buffer 10% trước threshold
7. UI: hiển thị estimator status pill

### Test loop
```bash
# Unit: localLengthEstimate đếm đúng số ký tự
# Unit: lệch < 30% → reliable
# Unit: lệch > 30% → unreliable
npm run test:vsbrain:auto-handoff  # PASS
npm run test:vsbrain:regression    # No regression
```

### Gate
- Hybrid estimator detect được unreliable
- Khi unreliable: không auto-handoff
- UI hiển thị reliable/unreliable rõ
- Regression không bị vỡ

### Output artifact
- `handoff.js` (tách từ relay/archive) với hybrid estimator
- UI estimator pill

---

## Step 9 — Payment UI + licensing (P3)

### Input
- Chưa có gì: không payment, không license
- BLUEPRINT v0.8.68 đã chốt giá ($5/tháng launch, $29/năm launch)

### Action
1. Tạo `payment.js` module:
   - `upgradeToPro()` — mở payment page
   - `validateLicense(key)` — verify license (stripe-like client-side check hoặc API)
   - `getLicenseStatus()` — `active | expired | none`
2. Payment UI:
   - Card trong popup.html: "Nâng cấp Pro"
   - Hiện giá: list price struck-through + launch promo
   - 2 option: tháng ($5) / năm ($29)
   - Nút "Nâng cấp" → mở payment page (Stripe / Paddle link)
3. License key input: sau payment → nhập key → validate → unlock Pro
4. License state persist trong chrome.storage.sync
5. Pro badge hiển thị khi active

### Test flow
```bash
# Unit: validateLicense valid key → active
# Unit: validateLicense invalid key → none
# Unit: getLicenseStatus expired → expired
# Manual: mở payment UI → verify giá hiển thị đúng
# Manual: nhập key mẫu → verify Pro unlock
```

### Gate
- Payment UI render đúng
- License validate pass/fail đúng
- Pro state persist qua reload
- Không vỡ UI Free lane

### Output artifact
- `payment.js`
- Payment UI trong popup.html
- Stripe/Paddle integration link
- License validation logic

---

## Step 10 — Release gate test suite (P3)

### Input
- Hiện tại: 12 lab scenarios, chưa có test cho termination spoofing, prompt injection, crash/reload recovery

### Action
Thêm test scenarios:

| ID | Case | Expected |
|---|---|---|
| TS-01 | Malformed termination envelope | Parser fail → no finalize |
| TS-02 | Two termination envelopes | Reject → no finalize |
| TS-03 | Termination nonce mismatch | Reject → no finalize |
| TS-04 | Prompt injection giả vở chốt | Envelope parser không match → no finalize |
| TS-05 | Duplicate save click | In-flight guard → chỉ 1 commit |
| TS-06 | Extension reload mid-loop | Reload state → recover loopState, không auto-send |
| TS-07 | Handoff estimator unreliable | Không auto-handoff → báo operator |
| TS-08 | Quota exceeded (free tier) | Dừng loop → CTA → không auto-finalize |
| TS-09 | Provider unavailable (tab closed) | Detect → không crash loop → fallback |
| TS-10 | 3-party majority consensus | 2/3 agree → finalize draft_forced |

### Test loop
```bash
npm run test:vsbrain:regression  # 22/22 PASS (previous 12 + 10 new)
```

### Gate
- 22/22 PASS
- Không scenario nào fail-close sai
- Cover được toàn bộ safety contract

### Output artifact
- 10 test scenarios mới
- Test matrix updated `TEST_MATRIX_V2.md`

---

## Step 11 — Build system: bundler + minify (P3)

### Input
- Hiện vẫn là script tags thủ công từ Step 1
- Demo/Full build vẫn copy file tay

### Action
1. Thêm esbuild hoặc rollup vào package.json
2. Build config: bundle JS modules → 1 file (hoặc code-split hợp lý)
3. Minify production build
4. Build targets: `demo` (capped 30 rounds), `free` (50 rounds, 2 providers), `pro` (unlimited, all providers)
5. Update `build:demo`, `build:full`, thêm `build:free`, `build:pro`
6. Source maps cho debug
7. Remove manual script tags trong popup.html → `<script src="vs-brain.bundle.js">`

### Test loop
```bash
npm run build:demo       # PASS
npm run build:free       # PASS
npm run build:pro        # PASS
npm run verify:all       # PASS_ALL
```

### Gate
- Demo/Free/Pro build đúng behavior tier
- Bundle load được trong extension
- Source map debug được

### Output artifact
- `package.json` scripts mới
- Build config (esbuild.config.mjs hoặc rollup.config.mjs)
- `dist/` hoặc `build/` directory với artifacts

---

## Step 12 — UI final polish (P3 — optional, sếp duyệt)

### Action
1. Glass-select refinement: đẹp hơn, animation mượt hơn
2. Provider logo grid: responsive, hiệu ứng hover
3. CTA card: design đẹp, không chiếm dụng quá nhiều không gian
4. Status bar: clear hiển thị estimator/payment/loop state
5. Dark mode: consistent
6. Help modal: cập nhật nội dung cho multi-provider + Pro/Free

### Test
```bash
# Manual visual check: screenshot từng panel
# Verify: không lỗi CSS/HTML trên Chrome Canary + Stable
```

### Gate
- UI không drift khỏi intended wave
- Owner approve visual final

---

## Tổng quan: thứ tự + phụ thuộc

```
Step 0 ──────► Step 1 ──────► Step 2 ──────► Step 3
(stabilize)    (module hóa)   (envelope)     (settings)
                                       │
                    ┌──────────────────┘
                    ▼
              Step 4 ──────► Step 5 ──────► Step 6
              (providers)    (free/pro)      (roundtable)
                    │              │              │
                    └──────────────┴──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                              ▼
              Step 7 ──────► Step 8         Step 10 ──────► Step 11
              (expand)       (handoff)       (tests)          (build)
                                             
                    Step 9 (payment) — song song với Step 10/11
                    
                    Step 12 (UI polish) — cuối cùng
```

| Step | Phụ thuộc | Có thể song song |
|---|---|---|
| 0 | — | — |
| 1 | 0 | — |
| 2 | 1 | — |
| 3 | 1 | 2 |
| 4 | 1 | 3 |
| 5 | 3, 4 | — |
| 6 | 1, 5 | 7 |
| 7 | 4 | 6 |
| 8 | 1 | 7, 9, 10 |
| 9 | 5 | 8, 10 |
| 10 | 2, 5 | 8, 9 |
| 11 | 10 | 12 |
| 12 | 11 | — |

---

## SOP Auto rules cho mỗi Step

1. **Trước khi làm:** đọc step plan này
2. **Làm:** sửa đúng file, đúng scope
3. **Test:** chạy test command đã liệt kê
4. **Verify:** so sánh output với gate condition
5. **Gate pass:** commit + ghi log → next step
6. **Gate fail:** fix → test lại → không chuyển step nếu gate chưa pass
7. **Blocker cứng:** báo sếp, không tự vượt gate

---

## Thời gian ước tính

| Step | Tên | ~Giờ |
|---|---|---|
| 0 | Stabilize baseline | 0.5 |
| 1 | Module hóa popup.js | 3–4 |
| 2 | Termination envelope protocol | 2 |
| 3 | Settings layer | 2 |
| 4 | Provider registry + selection UI | 3 |
| 5 | Free/Pro tier + quota | 3 |
| 6 | Multi-provider 3-way relay | 4–5 |
| 7 | Provider expansion x6 | 3–4 |
| 8 | Handoff estimator hybrid | 2 |
| 9 | Payment UI + licensing | 2–3 |
| 10 | Release gate test suite | 3 |
| 11 | Build system | 2 |
| 12 | UI polish | 2–3 |
| **Total** | | **32–37 giờ** |

---

*Plan created: 2026-06-02 19:30 GMT+7 | Phương COO*
*Next: Step 0 — stabilize baseline*
