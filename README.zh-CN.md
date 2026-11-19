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

异步请求使用插件前缀：向 `POST /gorquan_grok_image/v1/images/generations` 或 `POST /gorquan_grok_image/v1/images/edits` 发送 JSON，指定 `deferred: true`。输出格式只支持 `url`。提交返回网关的 `request_id`；使用同一用户的令牌轮询 `GET /gorquan_grok_image/v1/images/{request_id}`。处理中返回 202 和 `status: "pending"`，结束返回 200 和 `status: "done"`（含 `data` 和上游提供的 `usage`）或 `status: "failed"`（含 `error`）。无前缀的两个 POST 是宿主同步接口，不用于提交异步任务。

支持 `prompt`、`n`、`resolution`、`quality`、`aspect_ratio` 和 `response_format`。生成请求默认生成 1 张 `1k` 低质量图片。编辑支持 URL、data URL、文件引用和 multipart 图片输入。

## 计费

原版 New API RC51 无需修改宿主。在本仓库运行 `python3 install.py https://你的站点 --user-id 1`（换成管理员的用户 ID），按提示输入 New API 管理员访问令牌。安装器通过原版管理 API 激活插件，并只补缺失的插件价格规则，保留已有定价。随后绑定渠道，在渠道里填写 xAI key。

只在后台上传 `plugin.js` 不会安装价格。若手工安装，可为每个支持的模型设置插件专属表达式 `tier("base", u("upstream_cost_usd") * 1)`。提交前按请求参数预扣，完成后按 xAI 实际整单费用和分组倍率结算；上游明确返回零就按零结算，未返回费用则保留预扣。

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
