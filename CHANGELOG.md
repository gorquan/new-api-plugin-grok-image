---
changelogVersion: 1
plugin: "gorquan_grok_image"
version: "1.1.0"
locale: "en"
translations:
  zh-CN: CHANGELOG.zh-CN.md
---
# Changelog

## [1.1.0]

### Added

- Submit deferred image generation and editing jobs through the plugin-prefixed routes and poll the gateway request ID for image URLs.
- Run `install.py` on stock New API RC51 to install the plugin and its missing provider pricing rules without replacing configured prices.

### Fixed

- Synchronous generation and editing now forward the requested Base64 format and preserve the returned image MIME type.
- With the upstream-cost pricing rule, the gateway reserves an estimate and settles xAI's reported cost once for the whole request.
