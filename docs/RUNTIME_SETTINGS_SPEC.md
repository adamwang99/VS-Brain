# VS Brain — Runtime Settings Spec

Saved: 2026-05-27 18:29 GMT+7
Status: spec only, not implemented yet
Purpose: define next settings layer without rethinking product behavior later

## Goals

Add a minimal settings layer that improves operator control without bloating the side-panel.

Principles:
- simple-first
- safe defaults
- no hidden magic
- settings must map to observable runtime behavior

## Settings candidates

### 1. Auto Handoff threshold
Field:
- `auto_handoff_threshold_pct`

Type:
- integer

Default:
- `70`

Allowed range:
- `50` to `90`

Meaning:
- when estimated context usage reaches threshold, runtime may trigger handoff flow

UI note:
- advanced settings only

### 2. Auto Handoff enabled
Field:
- `auto_handoff_enabled`

Type:
- boolean

Default:
- `true`

Meaning:
- master gate for auto handoff behavior

### 3. Finalize timeout seconds
Field:
- `finalize_timeout_seconds`

Type:
- integer

Default:
- `180`

Allowed range:
- `60` to `600`

Meaning:
- max wait for final blueprint/spec response before finalize timeout

### 4. Action delay ms
Field:
- `action_delay_ms`

Type:
- integer

Default:
- `1200`

Allowed range:
- `300` to `10000`

Meaning:
- delay before focus/fill/send transitions

### 5. Certified provider badge
Field:
- `show_certified_provider_badge`

Type:
- boolean

Default:
- `true`

Meaning:
- show small UI hint that current production runtime is certified only for approved providers

### 6. Finalize mode preference
Field:
- `finalize_export_mode`

Type:
- enum

Default:
- `markdown_only`

Allowed values:
- `markdown_only`
- `bundle`

Meaning:
- default export mode for finalize flow
- current hardened recommendation remains `markdown_only`

## Out of scope for this spec

- pricing/plan gating
- multi-user sync
- cloud settings
- provider-specific secrets
- fully custom per-provider advanced panels

## Implementation notes

- settings should persist in `chrome.storage.local`
- settings UI should stay under advanced/details section
- every setting must have a reset-to-default path
- no setting should bypass certification gate logic

## Recommended implementation order

1. `finalize_timeout_seconds`
2. `auto_handoff_enabled`
3. `auto_handoff_threshold_pct`
4. `show_certified_provider_badge`
5. `finalize_export_mode`
