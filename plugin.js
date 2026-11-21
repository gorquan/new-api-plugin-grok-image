const IMAGE_MODELS = {
  "grok-imagine-image": {},
  "grok-imagine-image-2.0": {},
  "grok-imagine-image-pro": {},
  "grok-imagine-image-quality": {},
};

const IMAGE_RESOLUTIONS = ["1k", "1.5k", "2k"];
const IMAGE_QUALITIES = ["low", "medium", "auto"];
const IMAGE_ASPECT_RATIOS = [
  "1:1", "3:4", "4:3", "9:16", "16:9", "2:3", "3:2", "9:19.5",
  "19.5:9", "9:20", "20:9", "1:2", "2:1", "21:9", "5:2", "auto",
];
const MAX_IMAGE_COUNT = 10;
const MAX_IMAGE_INPUTS = 5;
const IMAGE_UNIT_LABEL = {
  en: "image", zh: "张", "zh-TW": "張", fr: "image", ja: "枚", ru: "изображение", vi: "ảnh",
};

const IMAGE_USAGE_SCHEMA = {
  image_count: {
    type: "number",
    unit: "count",
    unitLabel: IMAGE_UNIT_LABEL,
    description: { en: "Image generation unit price", zh: "图片生成单价" },
  },
  input_image_count: {
    type: "number",
    unit: "count",
    unitLabel: IMAGE_UNIT_LABEL,
    description: { en: "Input image unit price", zh: "输入图片单价" },
  },
  resolution: {
    enum: IMAGE_RESOLUTIONS,
    description: { en: "Output image resolution", zh: "输出图片分辨率" },
  },
  quality: {
    enum: IMAGE_QUALITIES,
    description: { en: "Output image quality", zh: "输出图片质量" },
  },
  upstream_cost_usd: {
    type: "number",
    unit: "credit",
    description: { en: "Upstream image cost unit price", zh: "上游图片费用单价" },
  },
};

export const meta = {
  apiVersion: 1,
  key: "gorquan_grok_image",
  name: "Grok Image",
  description: {
    en: "Grok Imagine image generation and editing",
    zh: "Grok Imagine 图片生成和编辑",
  },
  version: "1.2.7",
  author: { name: "gorquan", url: "https://github.com/gorquan" },
  baseUrl: "https://api.x.ai",
  models: Object.keys(IMAGE_MODELS),
  fetchMode: "per_task",
  upstreams: ["vendor", "new_api"],
  routes: [
    { method: "POST", path: "/gorquan_grok_image/v1/images/generations", type: "submit", decode: "deferGeneration", render: "accepted" },
    { method: "POST", path: "/gorquan_grok_image/v1/images/edits", type: "submit", decode: "deferEdit", render: "accepted" },
    { method: "GET", path: "/gorquan_grok_image/v1/images/:task_id", type: "query", render: "poll" },
  ],
  usageSchema: {
    image_count: {
      type: "number",
      unit: "count",
      unitLabel: { en: "image", zh: "张", "zh-TW": "張", fr: "image", ja: "枚", ru: "изображение", vi: "ảnh" },
      description: { en: "Image generation unit price", zh: "图片生成单价" },
    },
    input_image_count: {
      type: "number",
      unit: "count",
      unitLabel: { en: "image", zh: "张", "zh-TW": "張", fr: "image", ja: "枚", ru: "изображение", vi: "ảnh" },
      description: { en: "Input image unit price", zh: "输入图片单价" },
    },
    resolution: {
      enum: ["1k", "1.5k", "2k"],
      description: { en: "Output image resolution", zh: "输出图片分辨率" },
    },
    quality: {
      enum: ["low", "medium", "auto"],
      description: { en: "Output image quality", zh: "输出图片质量" },
    },
    upstream_cost_usd: {
      type: "number",
      unit: "credit",
      description: { en: "Upstream image cost unit price", zh: "上游图片费用单价" },
    },
  },
  usageExamples: [
    {
      label: "1k low",
      facts: { image_count: 1, input_image_count: 0, resolution: "1k", quality: "low", upstream_cost_usd: 0 },
    },
    {
      label: "2k medium · edit",
      facts: { image_count: 1, input_image_count: 1, resolution: "2k", quality: "medium", upstream_cost_usd: 0 },
    },
  ],
  protocols: [{ name: "openai_image", models: Object.keys(IMAGE_MODELS) }],
};

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function imageModel(identity) {
  const names = [identity && identity.upstreamModel, identity && identity.model].map(trimmed).filter(Boolean);
  for (const name of names) {
    if (Object.hasOwn(IMAGE_MODELS, name)) return name;
  }
  throw new Error((names[0] || "model") + " is not a supported xAI image model");
}

function imageAction(action) {
  return action === "image_edit" || action === "edit" ? "image_edit" : "image_generation";
}

function imageInteger(value, name, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum)
    throw new Error(name + " must be an integer between " + minimum + " and " + maximum);
  return value;
}

function imageInput(value, name) {
  const object = plainObject(value);
  if (!object) throw new Error(name + " must be an object with url, image_url or file_id");
  if (object.file_id != null) {
    if (!trimmed(object.file_id) || object.url != null || object.image_url != null)
      throw new Error(name + " must have a non-empty file_id or a URL, not both");
    return { file_id: object.file_id.trim() };
  }
  if (object.url != null && object.image_url != null)
    throw new Error(name + " must have only one URL");
  const url = object.url ?? object.image_url;
  if (typeof url === "string" && url.trim()) return { url: url.trim() };
  throw new Error(name + " requires a non-empty url, image_url or file_id");
}

function imageInputsFromBody(source) {
  if (source["image[]"] !== undefined) throw new Error("use image or images in the JSON body");
  const images = source.images === undefined ? [] : source.images;
  if (!Array.isArray(images)) throw new Error("images must be an array");
  if (source.image != null) {
    if (images.length) throw new Error("use image or images, not both");
    return [imageInput(source.image, "image")];
  }
  if (images.length > MAX_IMAGE_INPUTS) throw new Error("xAI image edits support at most " + MAX_IMAGE_INPUTS + " input images");
  return images.map((item, i) => imageInput(item, "images[" + i + "]"));
}

function imageRequest(source, identity, operation) {
  const body = plainObject(source);
  if (!body) throw new Error("request body must be an object");
  const model = imageModel(identity);
  const action = imageAction(operation);
  if (body.size !== undefined && body.size !== null && body.size !== "")
    throw new Error("size is not supported by xAI image models; use aspect_ratio and resolution");
  if (body.stream === true || body.stream === "true") throw new Error("stream is not supported");

  const prompt = promptField(body, true);
  const inputs = imageInputsFromBody(body);
  if (action === "image_edit" && inputs.length === 0) throw new Error("image is required for xAI image edits");
  if (action === "image_generation" && inputs.length > 0) throw new Error("image inputs require the image edit endpoint");

  const count = body.n ?? 1;
  if (!Number.isInteger(count) || count < 1 || count > MAX_IMAGE_COUNT)
    throw new Error("n must be a JSON integer between 1 and " + MAX_IMAGE_COUNT);
  const resolution = body.resolution ?? "1k";
  if (!IMAGE_RESOLUTIONS.includes(resolution)) throw new Error("resolution must be one of " + IMAGE_RESOLUTIONS.join(", "));
  let quality = body.quality ?? "auto";
  if (!IMAGE_QUALITIES.includes(quality)) throw new Error("quality must be one of low, medium, or auto");
  if (quality === "auto") quality = inputs.length > 0 ? "medium" : "low";
  const aspectRatio = body.aspect_ratio;
  if (aspectRatio != null && !IMAGE_ASPECT_RATIOS.includes(aspectRatio)) throw new Error("unsupported aspect_ratio for xAI image models");
  if (body.response_format != null && body.response_format !== "url" && body.response_format !== "b64_json")
    throw new Error("response_format must be url or b64_json");

  const request = { model: model, prompt: prompt, n: count, resolution: resolution, quality: quality };
  if (action === "image_edit" && body.mask !== undefined) request.mask = body.mask;
  if (body.user != null) {
    if (typeof body.user !== "string") throw new Error("user must be a string");
    request.user = body.user;
  }
  if (body.output != null) {
    const urls = plainObject(body.output) && body.output.upload_urls;
    if (!Array.isArray(urls) || (urls.length !== 0 && urls.length !== count) || !urls.every(u => typeof u === "string" && /^https?:\/\/\S+$/i.test(u)))
      throw new Error("output.upload_urls must be empty or contain one upload URL per output image");
    request.output = { upload_urls: urls };
  }
  if (body.storage_options != null) {
    const s = plainObject(body.storage_options);
    if (!s || !trimmed(s.filename)) throw new Error("storage_options.filename is required");
    const storage = { filename: s.filename };
    if (s.expires_after != null) storage.expires_after = imageInteger(s.expires_after, "storage_options.expires_after", 3600, 2592000);
    if (typeof s.public_url === "boolean") storage.public_url = s.public_url;
    else if (s.public_url !== undefined) {
      if (!plainObject(s.public_url)) throw new Error("storage_options.public_url must be a boolean or object");
      storage.public_url = {};
      if (s.public_url.expires_after != null)
        storage.public_url.expires_after = imageInteger(s.public_url.expires_after, "public_url.expires_after", 3600, 2592000);
    }
    request.storage_options = storage;
  }
  if (body.deferred === true) {
    if (body.response_format === "b64_json") throw new Error("deferred images require response_format=url");
    request.deferred = true;
  } else if (body.deferred != null && body.deferred !== false) {
    throw new Error("deferred must be a boolean");
  }
  if (body.response_format != null) request.response_format = body.response_format;
  if (aspectRatio) request.aspect_ratio = aspectRatio;
  if (inputs.length === 1) request.image = inputs[0];
  if (inputs.length > 1) request.images = inputs;
  return { action: action, body: request, inputCount: inputs.length };
}

function promptField(source, required) {
  if (source.prompt !== undefined && source.prompt !== null && typeof source.prompt !== "string") throw new Error("prompt must be a string");
  const prompt = trimmed(source.prompt);
  if (required && !prompt) throw new Error("prompt is required");
  return prompt;
}

function hasStorageResult(item) {
  return !!(plainObject(item) && (trimmed(item.file_output && item.file_output.file_id) || trimmed(item.storage_error)));
}

function imageEntries(body) {
  const data = plainObject(body) ? body.data : null;
  const entries = Array.isArray(data) ? data : data ? [data] : [];
  return entries.filter(function (item) {
    return plainObject(item) && (trimmed(item.url) || trimmed(item.b64_json) || hasStorageResult(item));
  });
}

function imagePayloadCount(body) {
  const data = plainObject(body) ? body.data : null;
  if (!Array.isArray(data)) return plainObject(data) && (trimmed(data.url) || trimmed(data.b64_json)) ? 1 : 0;
  let urls = 0;
  let b64s = 0;
  for (const item of data) {
    if (!plainObject(item)) continue;
    if (trimmed(item.url)) urls++;
    if (trimmed(item.b64_json)) b64s++;
  }
  return Math.max(urls, b64s);
}

function upstreamImageCost(body) {
  const usage = plainObject(body) && plainObject(body.usage) ? body.usage : null;
  if (!usage) return null;
  const raw = usage.cost_in_usd_ticks;
  if (typeof raw !== "number" && !(typeof raw === "string" && /^\d+$/.test(raw))) return null;
  const ticks = Number(raw);
  return Number.isSafeInteger(ticks) && ticks >= 0 ? ticks / 10000000000 : null;
}

function apiRoot(ctx, deferred) {
  return ctx.baseUrl + (ctx.upstream && ctx.upstream.kind === "new_api" ? (deferred ? "/gorquan_grok_image" : "/xai") : "");
}

export function buildSubmitRequest(ctx) {
  const request = imageRequest(ctx.requestBody || {}, ctx, ctx.action);
  return {
    url: apiRoot(ctx, request.body.deferred) + (request.action === "image_edit" ? "/v1/images/edits" : "/v1/images/generations"),
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + ctx.apiKey },
    body: Object.assign({}, request.body, { model: ctx.upstreamModel || ctx.model }),
    action: request.action,
    rewriteModel: ctx.upstreamModel || ctx.model,
  };
}

export function parseSubmitResponse(ctx, resp) {
  const body = plainObject(resp.body);
  if (!body) throw new Error("invalid xAI image response");
  if (ctx.requestBody && ctx.requestBody.deferred === true) {
    if (typeof body.request_id !== "string" || !/^[A-Za-z0-9_-]+$/.test(body.request_id)) throw new Error("xAI did not return a deferred request_id");
    return { taskId: body.request_id, taskData: { status: "pending" } };
  }
  const delivered = imageEntries(body);
  const charged = upstreamImageCost(body) > 0;
  const result = { taskId: ctx.publicTaskId, taskData: body };
  if (!delivered.length && !charged) result.immediate = { status: "FAILURE", reason: "xAI returned no images" };
  else result.immediate = { status: "SUCCESS", progress: "100%" };
  return result;
}

export function buildQueryRequest(ctx) {
  if (!ctx.taskId || !/^[A-Za-z0-9_-]+$/.test(ctx.taskId)) throw new Error("invalid deferred request_id");
  return { method: "GET", url: apiRoot(ctx, true) + "/v1/images/" + ctx.taskId,
    headers: { Accept: "application/json", Authorization: "Bearer " + ctx.apiKey } };
}

export function parseTaskResult(ctx, body, response) {
  if (!plainObject(body) || (response && (response.status < 200 || response.status >= 300))) return { status: "UNKNOWN" };
  if (body.status === "pending") return { status: "IN_PROGRESS" };
  if (body.status === "failed") return { status: "FAILURE", reason: trimmed(body.error && body.error.message) || "xAI image request failed" };
  if (body.status !== "done") return { status: "UNKNOWN" };
  // A positive vendor receipt settles even when no URL was delivered.
  if (!imageEntries(body).some(function (item) { return trimmed(item.url) || hasStorageResult(item); }) && !(upstreamImageCost(body) > 0))
    return { status: "FAILURE", reason: "xAI returned no image URL" };
  return { status: "SUCCESS", progress: "100%" };
}

function deferredIntent(ctx, operation) {
  const body = ctx.body && ctx.body.kind === "json" && plainObject(ctx.body.value);
  if (!body || body.deferred !== true) throw new Error("send a JSON body with deferred: true; use /v1/images for synchronous requests");
  const request = imageRequest(body, { model: body.model }, operation);
  return { kind: "submit", model: request.body.model, action: request.action, requestBody: request.body };
}

export const native = {
  deferGeneration: function (ctx) { return deferredIntent(ctx, "generate"); },
  deferEdit: function (ctx) { return deferredIntent(ctx, "edit"); },
  accepted: function (ctx, task) { return { request_id: task.task_id }; },
  poll: function (ctx, task) {
    const id = task.task_id;
    if (task.status === "FAILURE") {
      const err = plainObject(task.data) && plainObject(task.data.error);
      return { request_id: id, status: "failed", error: { code: (err && err.code) || "upstream_error", message: task.fail_reason || "Image request failed" } };
    }
    if (task.status !== "SUCCESS") return { __status: 202, __body: { request_id: id, status: "pending" } };
    const result = { request_id: id, status: "done", data: imageEntries(task.data) };
    if (plainObject(task.data.usage)) result.usage = task.data.usage;
    return result;
  },
};

export function extractUsage(ctx) {
  const request = imageRequest(ctx.requestBody || {}, ctx, ctx.action);
  if (ctx.usagePurpose === "billing_ratios") return { image_count: request.body.n };
  // Reserve using the validated vendor request and the published xAI image
  // rates (https://docs.x.ai/developers/pricing). The retired pro slug is
  // served by 2.0 at low quality. Use integer mills until the final conversion.
  const legacy = request.body.model === "grok-imagine-image";
  const medium = request.body.model === "grok-imagine-image-2.0" && request.body.quality === "medium";
  const outputMills = legacy ? 20 : { "1k": 40, "1.5k": 50, "2k": 60 }[request.body.resolution] + (medium ? 20 : 0);
  return {
    image_count: request.body.n,
    input_image_count: request.inputCount,
    resolution: request.body.resolution,
    quality: request.body.quality,
    upstream_cost_usd: (request.body.n * outputMills + request.inputCount * (legacy ? 2 : 10)) / 1000,
  };
}

export function extractUsageOnComplete(task, result, body) {
  if (!task || (task.action !== "image_generation" && task.action !== "image_edit")) return null;
  const facts = {};
  const count = imagePayloadCount(body);
  if (count > 0 && count <= MAX_IMAGE_COUNT) facts.image_count = count;
  const cost = upstreamImageCost(body);
  if (cost !== null) facts.upstream_cost_usd = cost;
  // Returning storage metadata alone must not turn an uncharged, undelivered
  // image into a charge at the reservation price. Leave the vendor receipt untouched.
  else if (count === 0 && imageEntries(body).some(hasStorageResult)) facts.upstream_cost_usd = 0;
  return facts;
}

export const protocols = {
  openai_image: {
    decodeRequest: function (ctx) {
      if (!ctx.body || ctx.body.kind !== "json") throw new Error("xAI image requests require application/json");
      const source = plainObject(ctx.body.value);
      if (!source) throw new Error("request body must be an object");
      if (source.deferred === true || source.deferred === "true") throw new Error("use /gorquan_grok_image/v1/images/" + (ctx.operation === "edit" ? "edits" : "generations") + " for deferred requests");
      const request = imageRequest(source, { model: ctx.model, upstreamModel: ctx.upstreamModel }, ctx.operation);
      return { kind: "submit", model: ctx.model, action: request.action, requestBody: request.body };
    },
    render: function (ctx, task) {
      const body = ctx.body;
      const format = body && body.kind === "json" ? body.value.response_format : undefined;
      const data = imageEntries(task.data).map(function (item) {
        if (trimmed(item.url) || trimmed(item.b64_json)) {
          if (format === "b64_json" && !trimmed(item.b64_json)) throw new Error("xAI did not return the requested b64_json");
          if (format === "url" && !trimmed(item.url)) throw new Error("xAI did not return the requested image URL");
        }
        const entry = {};
        if (trimmed(item.url)) entry.url = item.url;
        if (trimmed(item.b64_json)) entry.b64_json = item.b64_json;
        if (trimmed(item.mime_type)) entry.mime_type = item.mime_type;
        if (trimmed(item.revised_prompt)) entry.revised_prompt = item.revised_prompt;
        if (plainObject(item.file_output)) entry.file_output = item.file_output;
        if (typeof item.storage_error === "string") entry.storage_error = item.storage_error;
        return entry;
      });
      if (!data.length) throw new Error("xAI returned no images");
      const result = { created: task.created_at, data: data };
      // Keep xAI's measured cost available to API clients as well as the
      // settlement hook. Do not synthesize usage when the vendor omitted it.
      if (plainObject(task.data.usage)) result.usage = task.data.usage;
      return result;
    },
  },
};
