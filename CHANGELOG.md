---
changelogVersion: 1
plugin: "gorquan_grok_image"
version: "1.2.7"
locale: "en"
translations:
  zh-CN: CHANGELOG.zh-CN.md
---
# Changelog

## [1.2.7]

### Fixed

- Preserve file results and storage errors in response order even without an image URL or Base64. Storage metadata does not count as an image payload.

## [1.2.6]

### Fixed

- Settle the positive cost reported by a completed deferred task even without an image URL. JSON edits forward `mask` without treating it as a billable reference.

## [1.2.5]

### Added

- Edit with xAI Files API IDs, URL aliases, and mixed references. Use `storage_options`, `output.upload_urls`, and `user` on generation and editing requests.
- Use the retired `grok-imagine-image-quality` alias and read per-image storage results.

### Fixed

- Edits accept `image: null` alongside a non-empty `images` array and `images: []` alongside a single image. Only the supplied references count toward the reservation.

- Optional `user`, `deferred`, `storage_options` and `response_format` accept JSON `null`. Enum values must match exactly, expiry values must be integers, and edit references must be objects.

- Match xAI's handling of `n` and `output.upload_urls`: reject string counts and accept an empty upload destination list.

- Image editing now requires JSON, matching xAI. Clients uploading files with multipart must use a data URL or an xAI file ID instead.
- Non-string image payloads are not treated as delivered images. An explicit upstream cost still determines settlement.

## [1.1.0]

### Added

- Submit deferred image generation and editing jobs through the plugin-prefixed routes and poll the gateway request ID for image URLs.
- Run `install.py` on stock New API RC51 to install the plugin and its missing provider pricing rules without replacing configured prices.

### Fixed

- Synchronous generation and editing now forward the requested Base64 format and preserve the returned image MIME type.
- With the upstream-cost pricing rule, the gateway reserves an estimate and settles xAI's reported cost once for the whole request.
