import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";

import { McpHttpClient } from "../server/tools/mcp-http-client.mjs";

test("MCP HTTP client initializes a session, paginates tools and parses SSE tool results", async () => {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const message = JSON.parse(raw);
    requests.push({ message, headers: request.headers });
    if (message.method === "initialize") {
      response.writeHead(200, { "content-type": "application/json", "mcp-session-id": "session-1" });
      response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2025-03-26", serverInfo: { name: "fixture" } } }));
      return;
    }
    if (message.method === "notifications/initialized") {
      response.writeHead(202).end();
      return;
    }
    assert.equal(request.headers.authorization, "Bearer secret-token");
    assert.equal(request.headers["mcp-session-id"], "session-1");
    if (message.method === "tools/list" && !message.params.cursor) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { tools: [{ name: "first" }], nextCursor: "next" } }));
      return;
    }
    if (message.method === "tools/list") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { tools: [{ name: "second" }] } }));
      return;
    }
    if (message.method === "tools/call") {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.write(`data: ${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: "tool ok" }] } })}\n\n`);
      response.end();
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const client = new McpHttpClient({
    name: "fixture",
    url: `http://127.0.0.1:${address.port}/mcp`,
    headers: { Authorization: "Bearer secret-token" },
  });
  try {
    assert.deepEqual((await client.listTools()).map((tool) => tool.name), ["first", "second"]);
    const called = await client.callTool("fixture");
    assert.equal(called.content[0].text, "tool ok");
    assert.equal(requests[0].headers["mcp-session-id"], undefined);
  } finally {
    client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
