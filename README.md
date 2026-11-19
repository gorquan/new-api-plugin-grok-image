---
translations:
  zh-CN: README.zh-CN.md
---
# Grok Image

**English** | [简体中文](README.zh-CN.md)

An OpenAI Images API task plugin for xAI's Grok Imagine image generation and editing models.

## Channel setup

- Install the plugin, then create a channel of type **Task Plugin** and bind it to `gorquan_grok_image`.
- Create an xAI API key and put it in the channel key field. The plugin sends it as `Authorization: Bearer <key>`.
- Set the API address to `https://api.x.ai`. The plugin appends `/v1/images/generations` or `/v1/images/edits`.
- Add one or more supported Grok image models to the channel. Model mapping can expose them under another name.

## Models and endpoints

| Endpoint | Description | Models |
| --- | --- | --- |
| `POST /v1/images/generations` | Text-to-image generation | `grok-imagine-image`, `grok-imagine-image-2.0`, `grok-imagine-image-pro` |
| `POST /v1/images/edits` | Edit or compose input images | `grok-imagine-image`, `grok-imagine-image-2.0`, `grok-imagine-image-pro` |

For deferred processing, POST JSON with `deferred: true` to `/gorquan_grok_image/v1/images/generations` or `/gorquan_grok_image/v1/images/edits`. Only URL output is supported. Poll `GET /gorquan_grok_image/v1/images/{request_id}` with the gateway ID from the receipt and a token belonging to the submitting user. Pending returns HTTP 202; terminal responses return HTTP 200 with `status: "done"` (`data` and vendor `usage` when present) or `status: "failed"` (`error`). The unprefixed POST routes are the host's synchronous Images endpoints.

Supported request fields include `prompt`, `n`, `resolution`, `quality`, `aspect_ratio`, and `response_format`. Generation defaults to one `1k` image with low quality. Editing accepts URL, data URL, file-reference, and multipart image inputs.

## Billing

On stock New API RC51, run `python3 install.py https://your-gateway.example --user-id 1` from this repository (use your administrator user ID). Enter a New API administrator access token when prompted. The installer activates the bundled plugin and adds missing provider rules through the gateway's management API, preserving configured prices. Then bind the channel and enter the xAI key there.

Uploading `plugin.js` alone does not install prices on stock RC51. For manual setup the provider expression is `tier("base", u("upstream_cost_usd") * 1)` for each supported model. It reserves an estimate before submission, then charges xAI's measured cost for the whole task, with the site's group multiplier. An explicit zero is free; missing cost retains the reservation.

## Example

```bash
curl https://your-gateway.example/v1/images/generations \
  -H "Authorization: Bearer $NEWAPI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-imagine-image",
    "prompt": "A red paper boat on a calm blue lake, watercolor style",
    "n": 1,
    "resolution": "1k",
    "quality": "low",
    "aspect_ratio": "1:1",
    "response_format": "url"
  }'
```

## Limits

- `n` is limited to 1–10 output images.
- An edit accepts at most 5 input images.
- Each multipart input image is limited to 20 MiB.
- `mask`, `size`, and streaming requests are not supported.

## Links

- [xAI API documentation](https://docs.x.ai/docs)
- [New API plugin marketplace](https://www.newapi.ai/zh/plugins?market=community)
