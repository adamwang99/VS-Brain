# Chrome Web Store Listing — VS Brain (Free Tier)

**Version:** v0.8.50 (canonical) / v0.8.50-demo (store package).
**Repo:** https://github.com/adamwang99/VS-Brain
**Privacy policy:** https://adamwang99.github.io/VS-Brain/privacy.html
**Support email:** TODO (Sếp cấp trước khi submit).
**Category:** Productivity.

---

## Single-purpose statement (required by Google review)

> VS Brain relays the latest answer between two AI tabs you have open (such as ChatGPT, Gemini, Claude, Perplexity) so the two AIs can critique each other in turns, and exports the agreed result as a structured blueprint or decision ledger. It does this and nothing else.

This is intentionally one purpose: cross-AI critique relay + structured export. All other features (tab scan, archive, handoff, validator) exist only to support that single flow.

---

## Short description (≤132 characters, store summary line)

Cross-AI critique relay. Make ChatGPT and Gemini debate each other, then save the agreed blueprint or decision ledger.

(Char count: 130. Verified ≤132.)

---

## Long description (store body)

VS Brain turns ad-hoc copy/paste between AI tools into a structured workflow.

**What it does**

You open a source AI tab (for example ChatGPT) and a target AI tab (for example Gemini). You start VS Brain. It pastes the latest answer from one tab into the other tab as a structured critique prompt, waits for the response, pastes that back, and keeps going until both AIs agree or until a built-in safety budget forces a finalize. Then it saves a final report to your Downloads folder.

**Why this is useful**

- Long AI debates often fail in predictable ways: context grows, weaker models replace stronger models silently, fake agreement appears too early, and the final answer looks polished while real blockers remain. VS Brain adds operational guardrails around that process.
- It enforces an explicit stop phrase so a single AI cannot end the debate alone.
- It includes a "Decision Ledger" mode for evidence-anchored decisions: when you paste real data into the Evidence box, every claim in the final ledger must cite that data, and unsupported claims are marked as such instead of being presented as decisions.
- The loop always finalizes. If the AIs cannot converge, a budget triggers a forced final report so you never lose the work to a hung session.

**Output modes**

- Blueprint (default): unified blueprint Markdown — good for ideation, design discussion, and general-purpose prompts.
- Decision Ledger (needs payload): evidence-anchored decision record with required fields per decision (`evidence`, `counter_evidence`, `confidence`, `reverse_if`, `status`).

**Supported AI sites**

ChatGPT (chatgpt.com), Gemini (gemini.google.com), Claude (claude.ai), DeepSeek (chat.deepseek.com), Perplexity (www.perplexity.ai), Grok (grok.com).

**Privacy**

VS Brain runs entirely in your browser. There is no server. It does not collect, transmit, sell, or share personal data. It only reads the AI tabs listed in its manifest. Full privacy policy: https://adamwang99.github.io/VS-Brain/privacy.html

**Roadmap**

A paid tier with hosted prompts and longer-form analysis is planned for a future release on the project website. The free tier shipped here is fully functional on its own.

**Project**

VS Brain is initiated, directed, and owned by Adam Wang. Source: https://github.com/adamwang99/VS-Brain

---

## Permission justifications (paste into store form)

- **activeTab**: required to read the latest assistant reply from the AI tab the user is on, and to paste critique back into the destination AI tab.
- **tabs**: required to enumerate the user's open AI tabs and pick a source/target pair.
- **scripting**: required to extract the latest assistant message DOM and to paste the critique into the destination AI's composer.
- **storage**: required to remember the user's selected mode, intent, and custom prompt template across sessions on their own browser.
- **downloads**: required to save the final blueprint / decision-ledger bundle to the user's Downloads folder when they click finalize.
- **sidePanel**: required because the entire UI is rendered as a Chrome side panel.
- **windows**: required to bring the destination AI tab to the foreground while relaying a turn.
- **host_permissions** (explicit list of 6 AI sites + 127.0.0.1 for the developer mock lab): required so the extension can read assistant replies and inject critique only on those AI sites; the extension cannot read content on any other site.

---

## Submission checklist

- [x] manifest.json: `host_permissions` narrowed to 6 AI sites + 127.0.0.1.
- [x] Privacy policy file at `docs/privacy.html`, will be live at `https://adamwang99.github.io/VS-Brain/privacy.html` once GitHub Pages is enabled.
- [x] Single-purpose statement above.
- [x] Short + long description above.
- [x] Permission justifications above.
- [ ] **Sếp confirm**: enable GitHub Pages on `main` branch with `/docs` folder as source.
- [ ] **Sếp confirm**: support email used in the developer dashboard.
- [ ] Screenshots 1280x800 (or 640x400): Start card with Intent + Output selectors visible, debate running with loop counter, final blueprint saved log line, side panel layout. Either Sếp captures or Phương captures from a live session.
- [ ] Promo tile 440x280 (small) — optional but recommended.
- [ ] Pack `exports/demo/vs-brain-0.8.50-demo.zip` (already produced by `npm run build:demo`) → ready for upload.

When all 5 boxes are checked, the build can be uploaded via the Chrome Web Store developer dashboard. Initial review typically takes 1–3 business days.
