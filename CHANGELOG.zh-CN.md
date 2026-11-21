---
changelogVersion: 1
plugin: "gorquan_grok_image"
version: "1.2.8"
locale: "zh-CN"
---
# Changelog

## [1.2.8]

### Fixed

- 使用静态列表声明四个图片模型，让插件市场无需运行 JavaScript 即可读取模型和 Images 协议。

## [1.2.7]

### Fixed

- 同步和异步结果按原顺序保留只有文件信息或存储错误的条目，即使没有图片 URL 或 Base64。此类条目不计入图片张数。

## [1.2.6]

### Fixed

- 异步任务完成但无图片 URL 时，按上游明确报告的正费用结算。JSON 编辑原样转发 `mask`，不把它当作参考图预扣。

## [1.2.5]

### Added

- 编辑支持 xAI Files API 文件 ID、URL 兼容写法和混合引用。生图和编辑可传 `storage_options`、`output.upload_urls` 和 `user`。
- 支持旧模型名 `grok-imagine-image-quality`，响应保留每张图的存储结果。

### Fixed

- 编辑时，有效 `images` 可与 `image: null` 同传，单图 `image` 可与 `images: []` 同传。只按实际传入的参考图数量预扣。

- 可选的 `user`、`deferred`、`storage_options` 和 `response_format` 接受 JSON `null`。枚举值严格匹配，有效期必须为整数，编辑参考图必须使用对象。

- 对齐 xAI 的 `n` 和 `output.upload_urls` 校验：拒绝字符串张数，允许空上传地址列表。

- 编辑接口与 xAI 一致，只接受 JSON。原先用 multipart 上传文件的客户端应改用 Base64 data URL 或 xAI 文件 ID。
- 非字符串图片载荷不再被当作已交付的图片。上游明确报告费用时仍按整单金额结算。

## [1.1.0]

### Added

- 支持通过插件前缀接口提交异步生图和编辑，用网关返回的任务号查询图片 URL。
- 原版 New API RC51 可用 `install.py` 安装插件并补齐缺失的服务方计费规则，保留已配置价格。

### Fixed

- 同步生图和编辑会转发请求指定的 Base64 格式，并保留上游返回的图片 MIME 类型。
- 使用上游费用规则时，网关先预扣估算费用，再按 xAI 返回的整单金额结算一次。
