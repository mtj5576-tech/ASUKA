import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";

import { AnthropicClient, OpenAICompatibleClient } from "../server/native/provider-clients.mjs";

function writeEvent(response, type, payload) {
  response.write(`event: ${type}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

test("OpenAI-compatible provider wraps model tools in function objects", async () => {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    let raw = "";
    for await (const chunk of request) raw += chunk;
    requests.push({ path: url.pathname, headers: request.headers, body: JSON.parse(raw) });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    const client = new OpenAICompatibleClient({ baseUrl: `http://127.0.0.1:${address.port}/v1`, model: "deepseek-flash", apiKey: "secret" });
    const generated = await client.generate({
      system: "use tools",
      messages: [{ role: "user", content: "inspect" }],
      tools: [{ type: "function", name: "desktop_status", description: "Read status", parameters: { type: "object", properties: { verbose: { type: "boolean" } } } }],
      responseFormat: { type: "json_object" },
    });
    assert.equal(generated.text, "ok");
    assert.equal(requests[0].path, "/v1/chat/completions");
    assert.equal(requests[0].body.stream, false);
    assert.deepEqual(requests[0].body.tools, [{
      type: "function",
      function: {
        name: "desktop_status",
        description: "Read status",
        parameters: { type: "object", properties: { verbose: { type: "boolean" } } },
      },
    }]);
    assert.deepEqual(requests[0].body.response_format, { type: "json_object" });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Anthropic provider streams text, sends required headers and lists models", async () => {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/v1/models") {
      requests.push({ path: url.pathname, headers: request.headers });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "claude-test" }] }));
      return;
    }
    let raw = "";
    for await (const chunk of request) raw += chunk;
    requests.push({ path: url.pathname, headers: request.headers, body: JSON.parse(raw) });
    response.writeHead(200, { "content-type": "text/event-stream" });
    writeEvent(response, "message_start", { type: "message_start", message: { usage: { input_tokens: 4 } } });
    writeEvent(response, "content_block_delta", { type: "content_block_delta", delta: { type: "text_delta", text: "Anthropic " } });
    writeEvent(response, "content_block_delta", { type: "content_block_delta", delta: { type: "text_delta", text: "stream works" } });
    writeEvent(response, "message_delta", { type: "message_delta", usage: { output_tokens: 3 } });
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    const client = new AnthropicClient({
      baseUrl: `http://127.0.0.1:${address.port}`,
      model: "claude-test",
      apiKey: "anthropic-secret",
    });
    let streamed = "";
    const generated = await client.generate({
      system: "test system",
      messages: [{ role: "user", content: "test user" }],
      maxTokens: 64,
      onText: (_delta, full) => { streamed = full; },
    });
    assert.equal(generated.text, "Anthropic stream works");
    assert.equal(streamed, "Anthropic stream works");
    assert.deepEqual(await client.listModels(), ["claude-test"]);
    const messageRequest = requests.find((request) => request.path === "/v1/messages");
    assert.equal(messageRequest.headers["x-api-key"], "anthropic-secret");
    assert.equal(messageRequest.headers["anthropic-version"], "2023-06-01");
    assert.equal(messageRequest.body.stream, true);
    assert.equal(messageRequest.body.system, "test system");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Anthropic provider streams tool calls and serializes tool results", async () => {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw);
    requests.push(body);
    response.writeHead(200, { "content-type": "text/event-stream" });
    if (requests.length === 1) {
      writeEvent(response, "content_block_start", { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "toolu_1", name: "desktop_status", input: {} } });
      writeEvent(response, "content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: "{\"verbose\":true}" } });
      writeEvent(response, "message_delta", { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 6 } });
    } else {
      writeEvent(response, "content_block_delta", { type: "content_block_delta", delta: { type: "text_delta", text: "tool result accepted" } });
      writeEvent(response, "message_delta", { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 4 } });
    }
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    const client = new AnthropicClient({ baseUrl: `http://127.0.0.1:${address.port}`, model: "claude-test", apiKey: "secret" });
    const first = await client.generate({
      system: "use tools",
      messages: [{ role: "user", content: "inspect desktop" }],
      tools: [{ type: "function", name: "desktop_status", description: "Read status", parameters: { type: "object", properties: { verbose: { type: "boolean" } } } }],
    });
    assert.deepEqual(first.toolCalls.map((call) => [call.id, call.name, call.arguments]), [["toolu_1", "desktop_status", "{\"verbose\":true}"]]);
    assert.equal(requests[0].tools[0].input_schema.properties.verbose.type, "boolean");

    const second = await client.generate({
      system: "use tools",
      messages: [
        { role: "user", content: "inspect desktop" },
        { role: "assistant", content: "", tool_calls: first.toolCalls },
        { role: "tool", tool_call_id: "toolu_1", name: "desktop_status", content: "ready", images: [{ mimeType: "image/png", data: "iVBORw0KGgo=" }] },
      ],
      tools: [{ type: "function", name: "desktop_status", description: "Read status", parameters: { type: "object", properties: {} } }],
    });
    assert.equal(second.text, "tool result accepted");
    const toolResult = requests[1].messages[2].content[0];
    assert.equal(toolResult.type, "tool_result");
    assert.equal(toolResult.tool_use_id, "toolu_1");
    assert.equal(toolResult.content[0].text, "ready");
    assert.equal(toolResult.content[1].type, "image");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
