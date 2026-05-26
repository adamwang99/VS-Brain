# CrossCritic Changelog

## v0.5.1

- Fixed EN help modal title/button localization:
  - `Hướng dẫn CrossCritic` → `CrossCritic guide`
  - `Đóng` → `Close`
- Improved `Finalize & Save` output:
  - exports `final-<provider>-<timestamp>.md`
  - exports `final-<provider>-<timestamp>.json`
  - exports `final-<provider>-<timestamp>-finalize-prompt.md`
- Final MD report now includes structured sections:
  - Final conclusion / Kết luận cuối cùng
  - Unified final answer / Bản trả lời thống nhất
  - Resolved critique points / Các điểm phản biện đã xử lý
  - Remaining assumptions / Giả định, giới hạn còn lại
  - Next actions / Việc cần làm tiếp theo
  - Audit trail
- Final JSON now uses schema `crosscritic.final_report.v1`.

## v0.5.0

- Completed EN localization for core UI/dropdowns/modal placeholders.
- Added English labels for archive buttons and status text.

## v0.4.9

- Moved custom dropdown menus to `document.body` portal layer so they render above glass cards.

## v0.4.8

- Restored rounded glass card clipping.
- Removed layout offset.
- Positioned dropdown menu via button rect.

## v0.4.7

- Attempted dropdown clipping fix by z-index/overflow; superseded by v0.4.8/v0.4.9.

## v0.4.6

- Replaced native selects with custom glass dropdowns.
- Fixed EN UI selector bug.

## v0.4.5

- Added broader UI i18n for VI/EN.
- Improved dropdown style.

## v0.4.4

- Replaced exported help file with in-app help modal.

## v0.4.3

- Added editable critique prompt template.
- Added reset default prompt button.

## v0.4.2

- Added Auto source/target option.
- Set default max steps to 50.
- Switched font stack to Roboto/system.

## v0.4.1

- Applied refined glassmorphism UI styling.

## v0.4.0

- Added VI/EN mode.
- Added Finalize & Save baseline export.
