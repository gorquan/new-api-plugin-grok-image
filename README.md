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

The gateway also serves these routes under the plugin prefix, for example `/gorquan_grok_image/v1/images/generations`.

Supported request fields include `prompt`, `n`, `resolution`, `quality`, `aspect_ratio`, and `response_format`. Generation defaults to one `1k` image with low quality. Editing accepts URL, data URL, file-reference, and multipart image inputs.

## Billing

The plugin reports the requested and returned image count, input image count, output resolution, output quality, and upstream cost. Configure the channel's image unit price for `image_count`; input image pricing, resolution, quality, and upstream cost can be priced separately with the plugin usage fields.

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
