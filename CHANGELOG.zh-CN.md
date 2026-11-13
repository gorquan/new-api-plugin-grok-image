---
changelogVersion: 1
plugin: "gorquan_grok_image"
version: "1.0.0"
locale: "zh-CN"
---
# Changelog

## [1.0.0]

### Added

- 新增通过 OpenAI Images API 协议进行 Grok Imagine 图片生成和编辑。
- 支持 `grok-imagine-image`、`grok-imagine-image-2.0` 和 `grok-imagine-image-pro` 模型。
- 支持 JSON 和 multipart 图片输入，最多生成 10 张图片并接受最多 5 张编辑输入图片。
- 上报图片数量、输入图片数量、分辨率、质量和上游费用用于计费。
