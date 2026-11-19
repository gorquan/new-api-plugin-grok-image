---
changelogVersion: 1
plugin: "gorquan_grok_image"
version: "1.1.0"
locale: "zh-CN"
---
# Changelog

## [1.1.0]

### Added

- 支持通过插件前缀接口提交异步生图和编辑，用网关返回的任务号查询图片 URL。
- 原版 New API RC51 可用 `install.py` 安装插件并补齐缺失的服务方计费规则，保留已配置价格。

### Fixed

- 同步生图和编辑会转发请求指定的 Base64 格式，并保留上游返回的图片 MIME 类型。
- 使用上游费用规则时，网关先预扣估算费用，再按 xAI 返回的整单金额结算一次。
