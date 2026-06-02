# VS Brain Blueprint v0.8.68 — Pro Provider Selection + Demo Limit + Payment UI

## 0. Trạng thái nền

- Bản ổn định đã khóa: `v0.8.67`
- Stable snapshot local: `/home/phuong/.openclaw/workspace/projects/crosscritic-stable/vs-brain-0.8.67-stable-20260601-2244`
- GitHub release: `https://github.com/adamwang99/VS-Brain/releases/tag/vs-brain-v0.8.67-stable`
- Bản mới phát triển trên: `/home/phuong/.openclaw/workspace/projects/crosscritic`
- Không sửa snapshot stable.

---

## 1. Mục tiêu bản v0.8.68

Bản v0.8.68 chuyển VS Brain từ demo kỹ thuật sang bản có logic sản phẩm rõ:

1. Free có giới hạn thật:
   - 50 vòng phản biện mỗi phiên.
   - tối đa 2 AI tham gia mỗi phiên.
   - provider mặc định: Gemini + ChatGPT.
   - các provider khác vẫn hiện logo nhưng bị mờ/khóa, không chọn được.
   - được xuất draft, không xuất final nếu chưa hội tụ.
   - reload không được biến thành không giới hạn; cần lưu quota/session state tối thiểu.

2. Pro có lợi ích rõ:
   - `$11/tháng` list price, khuyến mại launch còn `$5/tháng`.
   - `$69/năm` list price, khuyến mại launch còn `$29/năm`.
   - không giới hạn vòng phản biện ở UI theo fair-use.
   - internal batch cap có thể là 100 vòng, nhưng tự mở rộng tiếp nếu chưa hội tụ; người dùng không phải setting.
   - tối đa 3 AI tham gia mỗi phiên.
   - danh sách provider lựa chọn mở rộng, không giới hạn ở 2 provider Free.
   - xuất final blueprint khi hội tụ.

3. Provider selection gọn:
   - người dùng có thể mở/kết nối nhiều provider.
   - mỗi phiên chỉ chọn active participants.
   - UI dạng logo một hàng, click để chọn.
   - app chỉ điều phối provider được selected, bỏ qua tab không selected.

4. Khi hết vòng chưa hội tụ:
   - popup giải thích rõ.
   - không xuất final blueprint giả.
   - cho lưu draft `review_required`.
   - Free có CTA nâng cấp Pro.
   - Pro có CTA tiếp tục thêm 100 vòng.

---

## 2. Product decisions đã chốt

### Free

```text
Giá: $0
Max rounds: 50 per session
Max active providers: 2
Default providers: Gemini + ChatGPT
Other provider logos: visible but locked/disabled
Export: draft only if not converged
Final blueprint: only if converged within limit
Reload behavior: must not reset usage blindly into unlimited access
```

### Pro

```text
List price tháng: $11
Launch promo tháng: $5
List price năm: $69
Launch promo năm: $29
Rounds: UI shows unlimited / auto-extend by fair-use
Internal batch cap: 100 rounds per run segment, auto-continue if not converged
Max active providers: 3
Provider choices: open list, not limited to Free 2
Export final: yes when converged
Pricing display: show struck-through list price + launch promo price
Promo framing: limited-time launch offer
```




### Pricing display rule

Pro pricing should be framed as launch promotion:

```text
Pro Monthly
$11/month → $5/month launch offer

Pro Annual
$69/year → $29/year launch offer
```

UI requirements:
- show list price with strikethrough.
- show launch price as primary.
- add small label: `Launch offer`.
- do not claim fake urgency unless there is real end date.

### Reload/quota rule for Free

Free 50 vòng không được reset mù bằng reload. v0.8.68 cần tối thiểu:

```text
session_id persisted in chrome.storage.local
rounds_used persisted per session_id
free_session_created_at persisted
```

MVP rule:

```text
Reload same browser/session → tiếp tục quota cũ.
New session/project → có thể nhận 50 vòng mới.
```

Anti-abuse full account/server quota để phase sau, không nhồi vào v0.8.68.

### Payment UI decision

v0.8.68 làm giao diện thanh toán đầy đủ nhưng mock/local unlock:

```text
Tab Việt Nam: QR chuyển khoản / payOS-VietQR placeholder
Tab Quốc tế: card / Paddle-Stripe placeholder
```

Payment thật đề xuất phase sau:

```text
Vietnam first: payOS/VietQR for QR automation.
International first: Paddle or Stripe depending account/legal readiness.
```

### Provider model

```text
Connected Providers = provider người dùng đã mở/đăng nhập/kết nối.
Active Participants = provider được tích chọn tham gia phiên hiện tại.
```

Rule cứng:

```text
App chỉ gửi prompt/copy phản biện giữa Active Participants.
Không gửi sang provider chỉ connected nhưng chưa selected.
```

---

## 3. Scope v0.8.68

### In scope

1. Plan/entitlement local config.
2. Provider logo picker.
3. Active participants enforcement.
4. Free/Pro round limit.
5. Max-round not-converged popup.
6. Draft/final export gate.
7. Pricing/payment modal UI.
8. Mock Pro unlock local để demo.
9. Metadata export có plan/round/provider info.

### Out of scope

1. Real Stripe/Paddle.
2. Backend subscription server.
3. Team plan.
4. >3 active providers trong Pro.
5. BYOK/API key billing.
6. Full account system.
7. Provider automation rewrite lớn.

---

## 4. UX blueprint

### 4.1 Provider logo row

Vị trí: màn setup/đầu phiên.

Layout:

```text
Chọn AI phản biện
[ChatGPT logo] [Gemini logo] [DeepSeek logo] [Claude logo] [Perplexity logo]
```

Selected state:

- logo sáng hơn.
- border accent.
- check badge góc phải trên.
- tooltip hiển thị tên provider.

Text nhỏ dưới hàng logo:

```text
Free chọn tối đa 2 AI. Pro chọn tối đa 3 AI mỗi phiên.
```

Free behavior:

```text
Gemini + ChatGPT selectable by default.
DeepSeek / Claude / Perplexity visible but dimmed and locked.
Click locked logo opens Pro upsell.
```

Pro behavior:

```text
All supported provider logos selectable, but active participants max = 3.
```

### 4.2 Provider card data

Mỗi provider trong UI cần metadata:

```json
{
  "id": "chatgpt",
  "label": "ChatGPT",
  "logo": "icons/providers/chatgpt.svg",
  "status": "connected|needs_login|rate_limited|disabled|unknown",
  "selected": true,
  "tabId": 123,
  "urlMatch": ["https://chatgpt.com/*", "https://chat.openai.com/*"]
}
```

### 4.3 Khi chọn quá giới hạn

Free chọn provider thứ 3:

```text
Bản Free cho phép tối đa 2 AI tham gia một phiên.
Nâng cấp Pro để dùng 3 AI phản biện cùng lúc.
```

Buttons:

```text
Nâng cấp Pro
Bỏ chọn
```

Pro chọn provider thứ 4:

```text
VS Brain Pro v1 giới hạn tối đa 3 AI mỗi phiên để giữ phản biện rõ ràng và dễ hội tụ.
Hãy bỏ chọn một provider để tiếp tục.
```

### 4.4 Pricing modal

Trigger:

- Free chọn provider thứ 3.
- Free hết 30 vòng chưa hội tụ.
- User bấm `Upgrade Pro`.

Content:

```text
Mở khóa VS Brain Pro

Free
- 50 vòng phản biện mỗi phiên
- Gemini + ChatGPT
- Xuất draft

Pro
- Giá gốc: $11/tháng hoặc $69/năm
- Khuyến mại launch: $5/tháng hoặc $29/năm
- Không giới hạn vòng phản biện theo fair-use
- Tự mở rộng nếu chưa hội tụ
- 3 AI tham gia
- Chọn từ nhiều provider
- Xuất Blueprint cuối khi hội tụ
```

Buttons:

```text
Nâng cấp Pro — $5/tháng (giá gốc $11)
Nâng cấp Pro năm — $29/năm (giá gốc $69)
Tiếp tục bản Free
```

v0.8.68: button mock unlock local, phải hiển thị rõ nếu chưa nối payment thật:

```text
Demo checkout: mở khóa Pro cục bộ để thử nghiệm. Thanh toán thật sẽ nối ở bản sau.
```

---

## 5. State model

### 5.1 Plan config

```js
const PLAN_LIMITS = {
  free: {
    maxRounds: 50,
    maxActiveProviders: 2,
    allowedProviderIds: ['gemini', 'chatgpt'],
    lockedProviderBehavior: 'dim_visible_upsell',
    canContinueAfterLimit: false,
    canExportFinal: true,
    canExportDraft: true,
  },
  pro: {
    maxRounds: Infinity,
    internalBatchRounds: 100,
    maxActiveProviders: 3,
    allowedProviderIds: '*',
    canAutoExtendAfterBatch: true,
    canExportFinal: true,
    canExportDraft: true,
  }
};
```

### 5.2 Session state

```js
{
  plan: "free" | "pro",
  roundLimit: 50 | Infinity,
  roundsUsed: 0,
  activeProviderIds: ["chatgpt", "gemini"],
  connectedProviderIds: ["chatgpt", "gemini", "deepseek", "claude"],
  convergenceState: "not_started" | "running" | "converged" | "not_converged" | "max_rounds_reached_not_converged",
  exportStatus: "none" | "draft" | "final",
  terminationReason: null | "converged" | "max_rounds" | "manual_stop" | "provider_error"
}
```

### 5.3 Export metadata

Final/draft bundle JSON phải có:

```json
{
  "app": "VS Brain",
  "version": "0.8.68",
  "plan": "free",
  "rounds_used": 50,
  "round_limit": 50,
  "active_providers": ["chatgpt", "gemini"],
  "connected_providers": ["chatgpt", "gemini", "deepseek"],
  "convergence_state": "max_rounds_reached_not_converged",
  "export_status": "draft",
  "termination_reason": "max_rounds"
}
```

---

## 6. Orchestration rule

### 6.1 Participant selection

Before each run:

```js
participants = connectedProviders.filter(p => p.selected && p.status === "connected")
```

Validate:

```js
participants.length >= 2
participants.length <= plan.maxActiveProviders
```

If invalid:

- too few: show setup warning.
- too many: enforce plan limit.

### 6.2 Copy/cross-critique label rule

For 3 participants: GPT, Gemini, DeepSeek.

Prompt gửi cho GPT phải include:

```text
Dưới đây là phản biện từ các AI khác.

[Phản biện từ Gemini]
...

[Phản biện từ DeepSeek]
...

Hãy đọc, phản hồi từng điểm, sửa câu trả lời nếu cần, và xuất phiên bản mới.
```

Prompt gửi cho Gemini:

```text
[Phản biện từ ChatGPT]
...

[Phản biện từ DeepSeek]
...
```

Prompt gửi cho DeepSeek:

```text
[Phản biện từ ChatGPT]
...

[Phản biện từ Gemini]
...
```

Rule:

```text
Không trộn phản biện không nhãn nguồn.
Không gửi nội dung từ provider chưa selected.
```

---

## 7. Max-round behavior

### 7.1 Free hết 30 vòng chưa hội tụ

State:

```text
max_rounds_reached_not_converged
```

Popup:

```text
Chưa đủ đồng thuận để xuất Blueprint cuối

VS Brain đã chạy hết 30 vòng phản biện của bản Free, nhưng các AI chưa đạt trạng thái đồng thuận cuối.

Để bảo vệ chất lượng, ứng dụng chưa xuất file Blueprint chính thức.
Bạn có thể lưu bản nháp hiện tại hoặc nâng cấp Pro để tiếp tục phản biện với 3 AI và 100 vòng mặc định.
```

Buttons:

```text
Nâng cấp Pro
Lưu bản nháp
Xem điểm chưa hội tụ
Dừng phiên
```

### 7.2 Pro hết 100 vòng chưa hội tụ

Popup:

```text
Phiên Pro đã đạt 100 vòng mặc định nhưng chưa hội tụ.
Bạn có thể tiếp tục thêm 100 vòng theo fair-use hoặc lưu bản nháp hiện tại.
```

Buttons:

```text
Tiếp tục thêm 100 vòng
Lưu bản nháp
Xem điểm chưa hội tụ
Dừng phiên
```

---

## 8. Export gate

### Rule

```text
If converged: allow final blueprint.
If not converged: allow draft only.
If Free max rounds reached and not converged: block final, show explanation + upgrade CTA.
If Pro internal 100-round batch reached and not converged: auto-extend silently or with small non-blocking status, no user setting required.
```

### Demo/free draft export

Filename:

```text
vs-brain-draft-review-required-<timestamp>.md
vs-brain-draft-review-required-<timestamp>.json
```

Status in file:

```text
status: review_required
reason: max_rounds_reached_not_converged
```

### Final export

Filename:

```text
vs-brain-final-blueprint-<timestamp>.md
vs-brain-final-blueprint-<timestamp>.json
```

Status:

```text
status: final
reason: converged
```

---

## 9. Technical implementation plan

### Phase A — Product config

Files likely touched:

- `apps/extension/popup.js`
- `apps/extension/popup.html`
- `apps/extension/styles.css` or inline style area if current architecture uses embedded CSS.

Tasks:

1. Add `PLAN_LIMITS`.
2. Add local storage key:
   - `vsbrain.plan`
   - `vsbrain.selectedProviders`
   - `vsbrain.sessionId`
   - `vsbrain.roundsUsedBySession`
   - `vsbrain.roundLimitOverride`
3. Add helper:
   - `getCurrentPlan()`
   - `getPlanLimits()`
   - `canSelectProvider(providerId)`
   - `getActiveParticipants()`

### Phase B — Provider logo picker

Tasks:

1. Add provider logo assets if missing.
2. Add compact one-row picker HTML.
3. Add selected badge CSS.
4. Bind click events.
5. Enforce plan max selected.
6. Persist selected providers.

Acceptance:

- Free cannot select 3.
- Pro can select 3.
- Pro cannot select 4.
- Selected state survives popup reopen.

### Phase C — Orchestration filter

Tasks:

1. Locate current provider/tab scan result.
2. Filter scanned tabs by selected provider IDs.
3. Ensure relay loop only uses active participants.
4. Add source labels in critique bundle.
5. Add participant list into export metadata.

Acceptance:

- 5 provider tabs open, 3 selected → only 3 receive prompts.
- Unselected provider not touched.
- Copy prompts include `[Phản biện từ X]` labels.

### Phase D — Round limit / popup

Tasks:

1. Track `roundsUsed` robustly.
2. Before starting next round, check limit.
3. If limit hit and not converged, set termination state.
4. Show modal.
5. Block final export.
6. Allow draft export.

Acceptance:

- Free at round 30 not converged → popup.
- Free final export disabled.
- Draft export works with `review_required`.
- Pro can continue another 100.

### Phase E — Pricing/payment UI mock

Tasks:

1. Add pricing modal.
2. Add monthly/yearly CTA.
3. Mock local unlock:
   - set `vsbrain.plan = pro`.
4. Show clear demo label.

Acceptance:

- Click Pro monthly → plan becomes pro locally.
- Provider limit changes from 2 to 3.
- Round limit changes from 30 to 100.

### Phase F — Build/verify/release

Tasks:

1. bump manifest version to `0.8.68`.
2. update runtime version label.
3. run:

```bash
npm run verify:all
npm run build:demo
npm run build:full
```

4. create release artifacts:

```text
exports/demo/vs-brain-0.8.68-demo.zip
exports/full/vs-brain-0.8.68-full.zip
```

---

## 10. Test matrix

### Provider selection

| Case | Plan | Connected | Selected attempt | Expected |
|---|---|---:|---:|---|
| Free select Gemini+ChatGPT | free | 5 | 2 | pass |
| Free click DeepSeek/Claude/Perplexity | free | 5 | 3 | blocked/locked + upgrade CTA |
| Free reload after 50 rounds | free | 5 | 2 | must preserve/derive limit; not unlimited by simple reload |
| Pro select 3 from any supported providers | pro | 5 | 3 | pass |
| Pro select 4 | pro | 5 | 4 | blocked |

### Orchestration

| Case | Tabs open | Selected | Expected |
|---|---:|---:|---|
| 5 open, 2 selected | 5 | 2 | send only 2 |
| 5 open, 3 selected | 5 | 3 | send only 3 |
| selected provider needs login | 3 | 3 | block/run warning |

### Rounds

| Case | Plan | Round | Converged | Expected |
|---|---|---:|---|---|
| Free round 49 | free | 49 | false | continue |
| Free round 50 | free | 50 | false | popup upgrade/draft |
| Free round 50 | free | 50 | true | final export |
| Pro round 100 | pro | 100 | false | auto-extend next batch, no blocking setting |

### Export

| Case | State | Expected |
|---|---|---|
| converged | final allowed |
| not converged | draft only |
| max rounds not converged | draft `review_required`, final blocked |

---

## 11. Risks / phản biện trước

### Risk 1 — Mock payment gây hiểu nhầm

Mitigation:

```text
UI có đầy đủ payment flow + QR placeholder, nhưng label rõ: demo checkout/local unlock nếu chưa nối payment thật.
```

### Payment channel research note

Gợi ý cho bản Việt Nam + quốc tế:

- Việt Nam quickest QR/API path: `payOS` hoặc `VietQR`/bank QR. Ưu điểm: QR chuyển khoản quen thuộc, phí thấp/miễn phí theo thông tin công khai của payOS, dễ demo giao diện quét QR.
- Việt Nam ví/cổng lớn: `MoMo`, `VNPay`, `ZaloPay`. Ưu điểm: nhận diện cao; nhược điểm: tích hợp/duyệt merchant có thể nặng hơn.
- Quốc tế: `Paddle` hoặc `Stripe`. Stripe tốt nếu account hợp lệ; Paddle thuận lợi hơn cho merchant-of-record/tax quốc tế nhưng cần kiểm điều kiện tài khoản.
- v0.8.68 nên làm payment UI trung lập: monthly/yearly, QR panel, card/international panel, webhook placeholder. Payment thật tách v0.8.69.

### Risk 2 — 3 provider làm loop phức tạp hơn 2 provider

Mitigation:

- build participant abstraction trước.
- source label bắt buộc.
- test 5 tabs open but 3 selected.

### Risk 3 — Provider logo UI đẹp nhưng thiếu trạng thái

Mitigation:

- logo row gọn.
- tooltip/status badge nhỏ.
- không mở card lớn.

### Risk 4 — Hết vòng nhưng người dùng vẫn muốn file

Mitigation:

- cho draft export.
- cấm final nếu chưa hội tụ.
- explain rõ vì sao.

### Risk 5 — Pro `$5/month` chưa có payment thật

Mitigation:

- v0.8.68 chỉ là product UI + local entitlement.
- v0.8.69 mới nối Stripe/Paddle.

---

## 12. Done definition

v0.8.68 done khi:

1. Stable v0.8.67 vẫn nguyên.
2. Version `0.8.68` nhất quán manifest/html/js.
3. Free limit: 30 rounds + 2 providers enforced.
4. Pro mock: 100 rounds + 3 providers enforced.
5. Logo picker hoạt động gọn.
6. Orchestrator chỉ dùng selected providers.
7. Hết vòng chưa hội tụ có popup đúng.
8. Final export bị block nếu chưa hội tụ.
9. Draft export có `review_required`.
10. `npm run verify:all` PASS.
11. `npm run build:demo` PASS.
12. `npm run build:full` PASS.

---

## 13. Suggested review questions for phản biện

1. Free 50 vòng có bị lách bằng reload/session reset không? Cần identity/session persistence nào tối thiểu?
2. Free chỉ cho Gemini + ChatGPT, provider khác mờ/khóa có đủ rõ không?
3. Pro 3 AI active nhưng nhiều provider selectable có đúng UX không?
4. Pro nên hiển thị “không giới hạn” hay “auto-extend theo fair-use” để tránh claim quá đà?
5. QR payment Việt Nam nên ưu tiên payOS/VietQR hay MoMo/VNPay?
6. Quốc tế nên dùng Paddle hay Stripe cho giai đoạn đầu?
7. Mock payment v0.8.68 nên giống thật đến mức nào để không gây hiểu nhầm?
8. `review_required` draft export có đủ rõ để tránh hiểu nhầm final không?
9. Có nên để tất cả provider logo hiện mở, nhưng Free chỉ khóa chọn, không ẩn không?
