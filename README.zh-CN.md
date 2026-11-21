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

异步请求使用插件前缀：向 `POST /gorquan_grok_image/v1/images/generations` 或 `POST /gorquan_grok_image/v1/images/edits` 发送 JSON，指定 `deferred: true`。输出格式只支持 `url`。使用网关返回的 `request_id` 和同一用户的令牌轮询 `GET /gorquan_grok_image/v1/images/{request_id}`。按正文的 `pending`、`done` 或 `failed` 判断状态；部分宿主处理中会返回 HTTP 200，并把 `pending` 放在 `__body` 中。完成时读取 `data` 和上游提供的 `usage`，失败时读取 `error`。无前缀的两个 POST 是同步接口。

两个接口也支持旧名 `grok-imagine-image-quality`。生成默认返回一张 `1k` 低质量图片的 URL。需要内嵌图片时显式传 `response_format: "b64_json"`，受宿主回包大小限制。

编辑请求只接受 `Content-Type: application/json`。单图用 `image`，多图按顺序放入 `images` 数组，两者不能同传。参考图可使用公开 URL、Base64 data URL（字段 `url` 或 `image_url`），或当前 xAI 渠道有权访问的 `file_id`。生图和编辑可传 `user`、`storage_options` 和 `output.upload_urls`（每张输出对应一个签名上传地址）；xAI 提供 `file_output`、`storage_error` 时会返回给客户端。

## 计费

原版 New API RC51 无需修改宿主。在本仓库运行 `python3 install.py https://你的站点 --user-id 1`（换成管理员的用户 ID），按提示输入 New API 管理员访问令牌。安装器通过原版管理 API 激活插件，并只补缺失的插件价格规则，保留已有定价。随后绑定渠道，在渠道里填写 xAI key。

只在后台上传 `plugin.js` 不会安装价格。若手工安装，可为每个支持的模型设置插件专属表达式 `tier("base", u("upstream_cost_usd") * 1)`。提交前按请求参数预扣，完成后按 xAI 实际整单费用和分组倍率结算；上游明确报零则扣零。有图片但费用缺失或无效时保留预扣；仅有存储信息且无有效费用时扣零。

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

- `n` 接受 1–10 的 JSON 整数；省略或传 `null` 时生成 1 张。`output.upload_urls` 可传空数组表示不上传；非空时，每张输出图需要一个上传地址。
- 编辑请求最多接受 5 张输入图片。
- 图片接口不支持 multipart 表单上传。
- JSON 编辑请求会原样转发 `mask`。xAI 未声明支持蒙版编辑，接受该字段不代表只修改选区。不支持 `size` 和流式请求。
- 异步任务返回 `done`、`data` 为空数组且上游明确报告正费用时，网关返回空结果，按上游金额结算。

## 链接

- [xAI API 文档](https://docs.x.ai/docs)
- [New API 插件市场](https://www.newapi.ai/zh/plugins?market=community)
