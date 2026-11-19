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
  ["edit", { kind: "multipart", fields: { prompt: ["Change to red"], response_format: ["b64_json"] },
    files: [{ field: "image", ref: "request_file:image", mimeType: "image/png" }] }],
]) {
  test(`${operation} preserves Base64 from the incoming request to the vendor and client`, () => {
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
    assert.throws(() => image.render(ctx, { data: { data: [{ url: "https://example.invalid/image" }] } }), /b64_json/);
  });
}

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
