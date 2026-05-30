# VS Brain — Versioning / Build Marker Policy

## Rule cứng
Mỗi lần cập nhật runtime/UI có user-visible effect, phải đổi **ít nhất 1 dấu nhận biết build**.

## 1. Khi nào tăng version chính
Tăng `manifest.json` version khi có một trong các thay đổi sau:
- thay đổi logic runtime
- thay đổi flow user-facing
- thay đổi safety gate
- thay đổi UI layout
- thay đổi export format
- thay đổi test gate quan trọng

## 2. Khi nào thêm build marker
Nếu thay đổi chưa đáng bump semantic lớn, vẫn phải đổi dấu nhận biết UI bằng suffix/build marker.

Format khuyến nghị:
- `v<semver>-<marker>`
- ví dụ:
  - `v0.8.18-g2`
  - `v0.8.18-handofffix`
  - `v0.8.19-safe`

## 3. Nơi phải đồng bộ
Ít nhất phải update cùng lúc ở:
- `apps/extension/manifest.json`
- `apps/extension/popup.html` (badge version nhìn thấy ngay)
- `README.md`
- `CHANGELOG.md`
- `PROJECT_STATUS.md`

## 4. Nghĩa của marker
- `g*` = UI/grid/build visual marker
- `safe*` = safety/runtime gate change
- `hf*` = hotfix
- `lab*` = lab/test-specific marker

## 5. Rule vận hành
Không được để tình trạng:
- code đã đổi
- UI đã đổi
- nhưng version/popup badge vẫn y cũ

Vì điều đó làm owner reload xong không biết đang ở bản nào.
