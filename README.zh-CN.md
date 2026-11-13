---
locale: zh-CN
---
# Grok Image

使用 xAI 的 Grok Imagine 图片模型进行图片生成和编辑的 OpenAI Images API 任务插件。

## 渠道设置

- 安装插件后，创建 **Task Plugin** 类型的渠道，并绑定 `gorquan_grok_image`。
- 创建 xAI API Key 并填入渠道密钥。插件会使用 `Authorization: Bearer <key>` 发送密钥。
- API 地址填写 `https://api.x.ai`，插件会追加 `/v1/images/generations` 或 `/v1/images/edits`。
- 将支持的 Grok 图片模型加入渠道，也可以通过模型映射对外使用其他名称。

## 模型与接口

| 接口 | 说明 | 模型 |
| --- | --- | --- |
| `POST /v1/images/generations` | 文生图 | `grok-imagine-image`、`grok-imagine-image-2.0`、`grok-imagine-image-pro` |
| `POST /v1/images/edits` | 编辑或组合输入图片 | `grok-imagine-image`、`grok-imagine-image-2.0`、`grok-imagine-image-pro` |

网关也会在插件前缀下提供这些接口，例如 `/gorquan_grok_image/v1/images/generations`。

支持 `prompt`、`n`、`resolution`、`quality`、`aspect_ratio` 和 `response_format`。生成请求默认生成 1 张 `1k` 低质量图片。编辑支持 URL、data URL、文件引用和 multipart 图片输入。

## 计费

插件会上报请求和实际返回的图片数量、输入图片数量、输出分辨率、输出质量以及上游费用。请为 `image_count` 配置图片单价；输入图片、分辨率、质量和上游费用可以使用插件用量字段分别定价。

## 示例

```bash
curl https://your-gateway.example/v1/images/generations \
  -H "Authorization: Bearer $NEWAPI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-imagine-image",
    "prompt": "水彩风格的宁静蓝色湖面上一只红色纸船",
    "n": 1,
    "resolution": "1k",
    "quality": "low",
    "aspect_ratio": "1:1",
    "response_format": "url"
  }'
```

## 限制

- `n` 支持 1–10 张输出图片。
- 编辑请求最多接受 5 张输入图片。
- 每个 multipart 输入图片大小限制为 20 MiB。
- 不支持 `mask`、`size` 和流式请求。

## 链接

- [xAI API 文档](https://docs.x.ai/docs)
- [New API 插件市场](https://www.newapi.ai/zh/plugins?market=community)
