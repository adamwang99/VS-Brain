# VS Brain v0.8.33-archivecanon

## What changed
- Archive UX is now bundle-first.
- Primary export is `archive chuẩn (.gz)`.
- `MD full` remains the human-readable companion export.
- Raw JSONL exports are hidden from release UI and retained only for debug/compatibility paths.

## Why
- Chrome extension download behavior was stable for `.md` and `.gz` but not stable for raw `.jsonl` filename fidelity.
- Bundle `.gz` preserves machine-safe archival with JSONL + Markdown + metadata inside one canonical package.

## User-visible behavior
- Release UI emphasizes:
  - `Tải archive chuẩn (.gz)`
  - `MD full`
- Advanced panel is now framed as debug/compatibility tooling.

## Verification
- Canonical live export test passes with named `.md` and `.gz` downloads.
- Full export wiring verification passes.
