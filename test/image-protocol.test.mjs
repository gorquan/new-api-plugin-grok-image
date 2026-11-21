import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSubmitRequest, protocols, extractUsage, extractUsageOnComplete, native, parseSubmitResponse, buildQueryRequest, parseTaskResult } from "../plugin.js";

const image = protocols.openai_image;
const model = "grok-imagine-image-2.0";
test("reserve from the upstream model and normalized request, settle the whole task once", () => {
  const images = Array.from({ length: 5 }, () => ({ url: "https://example.invalid/image" }));
  const ctx = { action: "image_edit", model: "public-alias", upstreamModel: model, requestBody: { prompt: "Combine", images, n: 2, resolution: "2k" } };
  assert.equal(extractUsage(ctx).upstream_cost_usd, 0.21);
  assert.equal(extractUsage({ ...ctx, upstreamModel: "grok-imagine-image-pro" }).upstream_cost_usd, 0.17);
  assert.equal(extractUsage({ ...ctx, upstreamModel: "grok-imagine-image" }).upstream_cost_usd, 0.05);
  const data = [{ url: "a" }, { url: "b" }];
  for (const ticks of [undefined, null, -1, "", false, "NaN"]) {
    assert.deepEqual(extractUsageOnComplete(ctx, {}, { data, usage: { cost_in_usd_ticks: ticks } }), { image_count: 2 });
  }
  for (const [ticks, usd] of [["900000000", 0.09], [0, 0]]) {
    assert.deepEqual(extractUsageOnComplete(ctx, {}, { data, usage: { cost_in_usd_ticks: ticks } }), { image_count: 2, upstream_cost_usd: usd });
  }
});
for (const [operation, body] of [
  ["generate", { kind: "json", value: { prompt: "Blue square", response_format: "b64_json" } }],
  ["edit", { kind: "json", value: { prompt: "Change to red", response_format: "b64_json",
    image: { url: "data:image/png;base64,YQ==" } } }],
]) {
  test(`${operation} delivers explicit Base64 without a second CDN request`, () => {
    const ctx = { model, operation, body };
    const intent = image.decodeRequest(ctx);
    const outgoing = buildSubmitRequest({ ...intent, model, baseUrl: "https://api.x.ai" });
    assert.equal(outgoing.body.response_format, "b64_json");
    const entry = { b64_json: "/9j/2Q==", mime_type: "image/jpeg" };
    const usage = { cost_in_usd_ticks: 410000000 };
    const receipt = { data: [entry], usage };
    const response = image.render(ctx, { data: receipt, created_at: 1 });
    assert.deepEqual(response.data, [entry]);
    assert.deepEqual(response.usage, usage);
    assert.deepEqual(extractUsageOnComplete(intent, {}, receipt), { image_count: 1, upstream_cost_usd: 0.041 });
    const hosted = { url: "https://example.invalid/image", file_output: { file_id: "file_qa" }, storage_error: "partial" };
    assert.throws(() => image.render(ctx, { data: { data: [hosted] } }), /b64_json/);
    assert.deepEqual(image.render({body:{kind:"json",value:{}}}, { data: { data: [hosted] } }).data, [hosted]);
  });
}

test("Files inputs and delivery options survive normalization on sync and deferred routes", () => {
  const value = { model, prompt: "Combine", images: [{ file_id: "file_a" }, { image_url: "https://example.invalid/image" }],
    user: "client", mask: { url: "https://example.invalid/mask.png" }, output: { upload_urls: ["https://example.invalid/image?signature=example"] },
    storage_options: { filename: "out.jpg", expires_after: 3600, public_url: false } };
  for (const intent of [image.decodeRequest({ model, operation: "edit", body: {kind: "json", value} }),
    native.deferEdit({ body: {kind: "json", value: {...value, deferred: true}} })]) {
    const {body} = buildSubmitRequest(intent);
    assert.deepEqual(body.images, [{ file_id: "file_a" }, {url: value.images[1].image_url}]);
    for (const k of ["user","storage_options","output","mask"]) assert.deepEqual(body[k],value[k]);
    assert.equal(extractUsage(intent).upstream_cost_usd, 0.08);
  }
  for (const fields of [{image: value.images[0]}, {images:[{file_id:"file_a",url:"https://example.invalid"}]},
    {output:{upload_urls:["https://example.invalid/a","https://example.invalid/b"]}}, {storage_options:{public_url:true}}]) {
    assert.throws(() => image.decodeRequest({model,operation:"edit",body:{kind:"json",value:{...value,...fields}}}));
  }
});

test("sync and deferred inputs use xAI JSON count and empty upload list semantics", () => {
  for (const operation of ["generate", "edit"]) {
    const fields = { model, prompt: "Icon", ...(operation === "edit" ? {image:{file_id:"file_a"}} : {}) };
    for (const deferred of [false,true]) {
      const decode = extra => {
        const body = {kind:"json",value:{...fields,...extra,deferred}};
        const ctx = {model,operation,body};
        return deferred ? (operation === "edit" ? native.deferEdit(ctx) : native.deferGeneration(ctx)) : image.decodeRequest(ctx);
      };
      for (const n of ["2", "", false, 1.5, 0, 11]) assert.throws(() => decode({n}), /JSON integer/);
      for (const n of [undefined,null,1,2,10]) {
        const intent = decode({n,output:{upload_urls:[]}});
        const outgoing = buildSubmitRequest(intent).body;
        assert.equal(outgoing.n,n ?? 1);
        assert.deepEqual(outgoing.output,{upload_urls:[]});
        assert.equal(extractUsage(intent).image_count,n ?? 1);
      }
      assert.equal(buildSubmitRequest(decode({output:null})).body.output,undefined);
      for (const output of [{},{upload_urls:null},{upload_urls:""},{upload_urls:["https://example.invalid/a"]}])
        assert.throws(() => decode({n:2,output}), /upload_urls/);
    }
  }
});

test("optional nulls use defaults; enums, expiry and image references are not coerced", () => {
  const send = (operation, extra) => buildSubmitRequest(image.decodeRequest({ model, operation,
    body: {kind:"json", value:{model,prompt:"icon",...extra}} })).body;
  const options = {user:null,response_format:null,deferred:null,storage_options:null};
  assert.deepEqual(send("generate", options), send("generate", {}));
  const url = "data:image/png;base64,YQ==";
  assert.deepEqual(send("edit", {image:{url,file_id:null},...options}).image,{url});
  assert.deepEqual(send("edit", {image:{file_id:"file_a",url:null}}).image,{file_id:"file_a"});
  assert.throws(() => send("edit",{image:url}), /object/);
  assert.throws(() => send("edit",{images:[url]}), /object/);
  for (const opts of [{resolution:"2K"},{resolution:""},{quality:"LOW"},{quality:""},
    {aspect_ratio:""},{aspect_ratio:" 1:1 "},{user:42},{deferred:"null"},{response_format:"null"},
    {storage_options:{filename:"qa.jpg",expires_after:"3600"}},
    {storage_options:{filename:"qa.jpg",public_url:{expires_after:"3600"}}}]) {
    assert.throws(() => send("generate",opts));
  }
  const storage_options = {filename:"qa.jpg",expires_after:3600,public_url:{expires_after:3600}};
  assert.deepEqual(send("generate",{storage_options}).storage_options,storage_options);
});

test("edits require JSON on both routes and preserve JSON reference order", () => {
  const model = "grok-imagine-image-quality";
  const body = {kind:"multipart", fields:{prompt:["combine"]}, files:[{field:"image",ref:"request_file:image"}]};
  assert.throws(() => image.decodeRequest({model,operation:"edit",body}), /application\/json/);
  assert.throws(() => native.deferEdit({body}), /JSON/);
  const images = [{file_id:"file_b"},{file_id:"file_a"}];
  const intent = image.decodeRequest({model,operation:"edit",body:{kind:"json",value:{prompt:"combine",images}}});
  assert.deepEqual(buildSubmitRequest(intent).body.images,images);
  assert.equal(extractUsage(intent).upstream_cost_usd,0.06);
});

test("edits count only supplied references on both sync and deferred routes", () => {
  const a={file_id:"file_a"}, b={file_id:"file_b"};
  for (const deferred of [false,true]) {
    const decode = fields => {
      const body={kind:"json",value:{model,prompt:"edit",deferred,...fields}};
      return deferred ? native.deferEdit({body}) : image.decodeRequest({model,operation:"edit",body});
    };
    for (const fields of [{image:null,images:[a,b]},{image:a,images:[]}]) {
      const intent=decode(fields), req=buildSubmitRequest(intent).body;
      assert.deepEqual(req.images ?? [req.image],fields.image ? [a] : [a,b]);
      assert.equal(extractUsage(intent).input_image_count,fields.image ? 1 : 2);
    }
    for (const fields of [{image:a,images:[b]},{image:a,images:null},{image:null,images:[]}])
      assert.throws(()=>decode(fields));
  }
});

test("only a real reported charge can settle a malformed image-only response", () => {
  const task={action:"image_generation"}, body={data:[{b64_json:{}},{url:123}]};
  assert.equal(parseSubmitResponse(task,{body}).immediate.status,"FAILURE");
  body.usage={cost_in_usd_ticks:400000000};
  assert.equal(parseSubmitResponse(task,{body}).immediate.status,"SUCCESS");
  assert.deepEqual(extractUsageOnComplete(task,{},body),{upstream_cost_usd:0.04});
});

test("storage results survive sync and deferred rendering without becoming billable image payloads", () => {
  const task = {action:"image_edit",task_id:"public"};
  const file = {file_output:{file_id:"file_a",filename:"image.jpg"}};
  const error = {storage_error:"Upload failed"};
  for (const data of [[file,error], [error], file]) {
    for (const ticks of [undefined, 0, 300000000]) {
      const body = {status:"done",data};
      if (ticks !== undefined) body.usage = {cost_in_usd_ticks:ticks};
      const expected = Array.isArray(data) ? data : [data];
      assert.equal(parseSubmitResponse(task,{body}).immediate.status,"SUCCESS");
      const result = parseTaskResult(task,body,{status:200});
      assert.equal(result.status,"SUCCESS");
      const view = {...task,...result,data:body};
      const poll = native.poll({},view);
      assert.deepEqual(poll.data,expected);
      assert.deepEqual(poll.usage,body.usage);
      for (const response_format of ["url","b64_json"]) {
        const sync = image.render({body:{kind:"json",value:{response_format}}},view);
        assert.deepEqual(sync.data,expected);
        assert.deepEqual(sync.usage,body.usage);
      }
      assert.deepEqual(extractUsageOnComplete(task,result,body),{upstream_cost_usd:(ticks ?? 0)/1e10});
    }
  }
  const mixed = {data:[error,{url:"https://example.invalid/output.jpg"},file]};
  assert.deepEqual(image.render({}, {data:mixed}).data,mixed.data);
  assert.deepEqual(extractUsageOnComplete(task,{},mixed),{image_count:1});
});

test("deferred image generation and editing expose only the gateway ID and report completion usage", () => {
  for (const operation of ["generate", "edit"]) {
    const value = { model, prompt: "Test", deferred: true, n: 2 };
    if (operation === "edit") value.image = { url: "https://example.invalid/input.png" };
    const ctx = { model, operation, body: { kind: "json", value } };
    assert.throws(() => image.decodeRequest(ctx), /gorquan_grok_image/);
    const intent = operation === "edit" ? native.deferEdit(ctx) : native.deferGeneration(ctx);
    const driver = { ...intent, publicTaskId: "task_public", baseUrl: "https://api.x.ai", apiKey: "fixture" };
    assert.equal(buildSubmitRequest(driver).body.deferred, true);
    const accepted = parseSubmitResponse(driver, { body: { request_id: "private-id" } });
    assert.equal(accepted.taskId, "private-id");
    assert.equal(accepted.immediate, undefined);
    const view = { task_id: driver.publicTaskId, status: "SUBMITTED", data: accepted.taskData };
    assert.deepEqual(native.accepted(ctx, view), { request_id: "task_public" });
    assert.deepEqual(native.poll(ctx, view), { __status: 202, __body: { request_id: "task_public", status: "pending" } });
    assert.equal(buildQueryRequest({ ...driver, taskId: accepted.taskId }).url, "https://api.x.ai/v1/images/private-id");
    const done = { status: "done", request_id: accepted.taskId, usage: { cost_in_usd_ticks: 400000000 }, data: [{ url: "https://example.invalid/done.jpg" }] };
    assert.equal(parseTaskResult(driver, {status:"pending"}, {status:202}).status, "IN_PROGRESS");
    assert.equal(parseTaskResult(driver, done, {status:200}).status, "SUCCESS");
    assert.deepEqual(extractUsageOnComplete(intent, {}, done), { image_count: 1, upstream_cost_usd: 0.04 });
    assert.deepEqual(native.poll(ctx, {...view, status: "SUCCESS", data: done}), {...done, request_id: "task_public"});
    assert.equal(parseTaskResult(driver, {status:"failed",error:{message:"upstream failure"}}, {status:200}).status, "FAILURE");
    assert.equal(parseTaskResult(driver, {status:"other"}, {status:200}).status, "UNKNOWN");
    value.response_format = "b64_json";
    assert.throws(() => operation === "edit" ? native.deferEdit(ctx) : native.deferGeneration(ctx), /require response_format=url/);
  }
});

test("empty deferred completion settles only a positive upstream receipt and returns no invented image", () => {
  const task = {action:"image_edit", task_id:"task_public"};
  const done = {status:"done", data:[], usage:{cost_in_usd_ticks:300000000}};
  const result = parseTaskResult(task, done, {status:200});
  assert.equal(result.status, "SUCCESS");
  assert.deepEqual(extractUsageOnComplete(task, result, done), {upstream_cost_usd:0.03});
  assert.deepEqual(native.poll({}, {...task,...result,data:done}), {...done,request_id:task.task_id});
  for (const ticks of [0, undefined, -1, "invalid"])
    assert.equal(parseTaskResult(task, {...done,usage:{cost_in_usd_ticks:ticks}}, {status:200}).status, "FAILURE");
  assert.equal(parseTaskResult(task, {...done,status:"pending"}, {status:202}).status, "IN_PROGRESS");
  assert.equal(parseTaskResult(task, done, {status:404}).status, "UNKNOWN");
});
