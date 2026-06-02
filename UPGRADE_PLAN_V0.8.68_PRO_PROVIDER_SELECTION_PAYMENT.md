# VS Brain Upgrade Plan — v0.8.68 Pro Provider Selection + Demo Limit

## Baseline locked
- Stable snapshot: `/home/phuong/.openclaw/workspace/projects/crosscritic-stable/vs-brain-0.8.67-stable-20260601-2244`
- Baseline version: `0.8.67`
- Do not mutate stable snapshot.

## Product decisions from Adam
- Free: 30 phản biện/vòng limit, tối đa 2 AI tham gia mỗi phiên.
- Pro: `$5/month`, `$29/year`.
- Pro v1: mặc định 100 vòng/phien, tối đa 3 providers tham gia mỗi phiên.
- App có thể hỗ trợ nhiều providers đã đăng nhập, nhưng active participants mỗi phiên chỉ là selected providers.
- Provider picker UI: logo compact trên 1 hàng; click logo để selected badge.
- If opened 5 provider tabs but selected 3, app only orchestrates selected 3.
- Payment UI first can be placeholder/demo; integrate real checkout later.

## Upgrade scope v0.8.68
1. Plan/entitlement config
   - Add local plan model: `free | pro`.
   - Defaults:
     - free: `maxRounds=30`, `maxActiveProviders=2`.
     - pro: `defaultMaxRounds=100`, `maxActiveProviders=3`, fair-use continue.
   - Store locally in Chrome storage for demo.

2. Provider selection UI
   - Replace bulky provider selection with single-row logo picker.
   - Show connected providers and selected state separately.
   - Selected badge: top-right check + accent ring.
   - Enforce max selected by plan.
   - Providers initial supported: ChatGPT, Gemini, DeepSeek, Claude, Perplexity.

3. Orchestration rule
   - Build participant list from selected providers only.
   - Ignore opened/unselected tabs.
   - Every copied critique must include source label:
     - `[Phản biện từ Gemini]`
     - `[Phản biện từ ChatGPT]`
     - `[Phản biện từ DeepSeek]`
   - For N participants, each model receives N-1 labelled critiques.

4. Max-round popup
   - When `roundsUsed >= plan.maxRounds` and not converged:
     - show modal: chưa hội tụ, chưa xuất final blueprint.
     - Free CTA: upgrade Pro.
     - Pro CTA: continue another 100 rounds / fair-use.
   - Demo can export draft with `review_required`; not final.

5. Pricing/payment UI
   - Add compact pricing modal:
     - Free: 30 rounds, 2 AI.
     - Pro: $5/month, $29/year, 100 default rounds, 3 AI.
   - Add buttons:
     - `Nâng cấp Pro — $5/tháng`
     - `Nâng cấp Pro năm — $29/năm`
   - Phase v0.8.68: local mock unlock only, clearly labelled if not wired to real payment.

6. Export state hardening
   - `final_blueprint` only when converged.
   - If forced/draft due to limit: `status=review_required`.
   - Include `plan`, `maxRounds`, `activeProviders`, `terminationReason` in final bundle JSON.

## Non-goals v0.8.68
- Real Stripe/Paddle integration.
- More than 3 active providers in Pro.
- Team plan.
- API-key billing.
- Backend subscription server.

## Test plan
- Unit/manual:
  - Free cannot select provider #3.
  - Pro can select provider #3 but not #4.
  - If 5 tabs exist, only selected provider IDs receive prompts.
  - Round 30 Free not converged opens upgrade modal, final export disabled.
  - Pro round 100 not converged opens continue modal.
  - Export draft contains `review_required`.
- Existing regression:
  - `npm run verify:all`
  - `npm run build:demo`
  - `npm run build:full`

## Release target
- `0.8.68-pro-provider-picker-demo-payment`
- Keep v0.8.67 stable snapshot as rollback.
