const IMAGE_MODELS = {
  "grok-imagine-image": {},
  "grok-imagine-image-2.0": {},
  "grok-imagine-image-pro": {},
};

const IMAGE_RESOLUTIONS = ["1k", "1.5k", "2k"];
const IMAGE_QUALITIES = ["low", "medium", "auto"];
const IMAGE_ASPECT_RATIOS = [
  "1:1", "3:4", "4:3", "9:16", "16:9", "2:3", "3:2", "9:19.5",
  "19.5:9", "9:20", "20:9", "1:2", "2:1", "21:9", "5:2", "auto",
];
const MAX_IMAGE_COUNT = 10;
const MAX_IMAGE_INPUTS = 5;
const MAX_IMAGE_INPUT_BYTES = 20 * 1024 * 1024;
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
  version: "1.1.0-rc.3",
  author: { name: "gorquan", url: "https://github.com/gorquan" },
  baseUrl: "https://api.x.ai",
  models: ["grok-imagine-image", "grok-imagine-image-2.0", "grok-imagine-image-pro"],
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
  protocols: [{ name: "openai_image", models: ["grok-imagine-image", "grok-imagine-image-2.0", "grok-imagine-image-pro"] }],
};

function trimmed(value) {
  return String(value || "").trim();
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function imageModel(identity) {
  const names = [identity && identity.upstreamModel, identity && identity.model].map(trimmed).filter(Boolean);
  for (const name of names) {
    if (IMAGE_MODELS[name]) return name;
  }
  throw new Error((names[0] || "model") + " is not a supported xAI image model");
}

function imageAction(action) {
  return action === "image_edit" || action === "edit" ? "image_edit" : "image_generation";
}

function imageInteger(value, name, minimum, maximum) {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isInteger(number) || number < minimum || number > maximum)
    throw new Error(name + " must be an integer between " + minimum + " and " + maximum);
  return number;
}

function imageInput(value, name) {
  const object = plainObject(value);
  if (object && object.__fileRef) return { url: object };
  if (object && object.file_id !== undefined) throw new Error(name + " must be a URL; file_id is not supported");
  const url = object && Object.prototype.hasOwnProperty.call(object, "url") ? object.url : value;
  if (plainObject(url) && url.__fileRef) return { url: url };
  if (typeof url === "string" && url.trim()) return { url: url.trim() };
  throw new Error(name + " must be a URL or {url}");
}

function imageInputsFromBody(source, files) {
  const inputs = [];
  const add = function (value, name) {
    if (Array.isArray(value)) {
      value.forEach(function (item, index) {
        inputs.push(imageInput(item, name + "[" + index + "]"));
      });
    } else if (value !== undefined && value !== null && value !== "") {
      inputs.push(imageInput(value, name));
    }
  };

  add(source.image, "image");
  add(source["image[]"], "image[]");
  add(source.images, "images");
  for (const file of files || []) {
    if (!/^image(\[\d*\])?$/.test(file.field)) throw new Error(file.field + " is not supported");
    const mimeType = trimmed(file.mimeType).toLowerCase();
    inputs.push({
      url: {
        __fileRef: file.ref,
        encoding: "dataUrl",
        mimeType: /^image\/[a-z0-9.+-]+$/.test(mimeType) ? mimeType : "image/png",
        maxBytes: MAX_IMAGE_INPUT_BYTES,
      },
    });
  }
  if (inputs.length > MAX_IMAGE_INPUTS) throw new Error("xAI image edits support at most " + MAX_IMAGE_INPUTS + " input images");
  return inputs;
}

function imageRequest(source, identity, operation, files) {
  const body = plainObject(source);
  if (!body) throw new Error("request body must be an object");
  const model = imageModel(identity);
  const action = imageAction(operation);
  const bodyFiles = files || [];
  if (bodyFiles.some(function (file) { return file.field === "mask"; }) || (action === "image_edit" && body.mask !== undefined && body.mask !== null))
    throw new Error("mask is not supported");
  if (body.size !== undefined && body.size !== null && body.size !== "")
    throw new Error("size is not supported by xAI image models; use aspect_ratio and resolution");
  if (body.stream === true || body.stream === "true") throw new Error("stream is not supported");

  const prompt = promptField(body, true);
  const inputs = imageInputsFromBody(body, bodyFiles);
  if (action === "image_edit" && inputs.length === 0) throw new Error("image is required for xAI image edits");
  if (action === "image_generation" && inputs.length > 0) throw new Error("image inputs require the image edit endpoint");

  const count = imageInteger(body.n === undefined || body.n === null || body.n === "" ? 1 : body.n, "n", 1, MAX_IMAGE_COUNT);
  const resolution = body.resolution === undefined || body.resolution === null || body.resolution === "" ? "1k" : trimmed(body.resolution).toLowerCase();
  if (!IMAGE_RESOLUTIONS.includes(resolution)) throw new Error("resolution must be one of " + IMAGE_RESOLUTIONS.join(", "));
  let quality = body.quality === undefined || body.quality === null || body.quality === "" ? "" : trimmed(body.quality).toLowerCase();
  if (!IMAGE_QUALITIES.includes(quality || "auto")) throw new Error("quality must be one of low, medium, or auto");
  if (quality === "" || quality === "auto") quality = inputs.length > 0 ? "medium" : "low";
  const aspectRatio = body.aspect_ratio === undefined || body.aspect_ratio === null || body.aspect_ratio === "" ? "" : trimmed(body.aspect_ratio);
  if (aspectRatio && !IMAGE_ASPECT_RATIOS.includes(aspectRatio)) throw new Error("unsupported aspect_ratio for xAI image models: " + aspectRatio);
  if (body.response_format !== undefined && body.response_format !== "url" && body.response_format !== "b64_json")
    throw new Error("response_format must be url or b64_json");

  const request = { model: model, prompt: prompt, n: count, resolution: resolution, quality: quality };
  if (body.deferred === true) {
    if (body.response_format === "b64_json") throw new Error("deferred images require response_format=url");
    request.deferred = true;
  } else if (body.deferred !== undefined && body.deferred !== false) {
    throw new Error("deferred must be a boolean");
  }
  if (body.response_format !== undefined) request.response_format = body.response_format;
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

function imageEntries(body) {
  const data = plainObject(body) ? body.data : null;
  const entries = Array.isArray(data) ? data : data ? [data] : [];
  return entries.filter(function (item) {
    return plainObject(item) && (trimmed(item.url) || trimmed(item.b64_json));
  });
}

function imagePayloadCount(body) {
  const data = plainObject(body) ? body.data : null;
  if (!Array.isArray(data)) return imageEntries(body).length;
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
  const ticks = usage ? Number(usage.cost_in_usd_ticks) : NaN;
  return Number.isFinite(ticks) && ticks >= 0 ? ticks / 10000000000 : 0;
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
  if (!imageEntries(body).some(function (item) { return trimmed(item.url); })) return { status: "FAILURE", reason: "xAI returned no image URL" };
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
  return {
    image_count: request.body.n,
    input_image_count: request.inputCount,
    resolution: request.body.resolution,
    quality: request.body.quality,
    upstream_cost_usd: 0,
  };
}

export function extractUsageOnComplete(task, result, body) {
  if (!task || (task.action !== "image_generation" && task.action !== "image_edit")) return null;
  return { image_count: imagePayloadCount(body), upstream_cost_usd: upstreamImageCost(body) };
}

export const protocols = {
  openai_image: {
    decodeRequest: function (ctx) {
      if (!ctx.body || (ctx.body.kind !== "json" && ctx.body.kind !== "multipart")) throw new Error("JSON or multipart body required");
      let source;
      let files = [];
      if (ctx.body.kind === "json") {
        source = plainObject(ctx.body.value);
        if (!source) throw new Error("request body must be an object");
      } else {
        source = {};
        const fields = ctx.body.fields || {};
        for (const name of Object.keys(fields)) {
          if (fields[name].length > 1 && name !== "image" && name !== "image[]") throw new Error(name + " must be provided once");
          source[name] = fields[name].length === 1 ? fields[name][0] : fields[name];
        }
        files = ctx.body.files || [];
        if (files.some(function (file) { return file.field === "mask"; }) || source.mask !== undefined)
          throw new Error("mask is not supported");
      }
      if (source.deferred === true || source.deferred === "true") throw new Error("use /gorquan_grok_image/v1/images/" + (ctx.operation === "edit" ? "edits" : "generations") + " for deferred requests");
      if (ctx.body.kind === "multipart" && source.deferred === "false") source.deferred = false;
      const request = imageRequest(source, { model: ctx.model, upstreamModel: ctx.upstreamModel }, ctx.operation, files);
      return { kind: "submit", model: ctx.model, action: request.action, requestBody: request.body };
    },
    render: function (ctx, task) {
      const body = ctx.body;
      const format = body && body.kind === "json" ? body.value.response_format
        : body && body.fields && body.fields.response_format && body.fields.response_format[0];
      const data = imageEntries(task.data).map(function (item) {
        if (format === "b64_json" && !trimmed(item.b64_json)) throw new Error("xAI did not return the requested b64_json");
        if (format === "url" && !trimmed(item.url)) throw new Error("xAI did not return the requested image URL");
        const entry = {};
        if (trimmed(item.url)) entry.url = item.url;
        if (trimmed(item.b64_json)) entry.b64_json = item.b64_json;
        if (trimmed(item.mime_type)) entry.mime_type = item.mime_type;
        if (trimmed(item.revised_prompt)) entry.revised_prompt = item.revised_prompt;
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
