import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { McpStdioClient } from "../server/tools/mcp-client.mjs";

const serverSource = String.raw`
import { createInterface } from "node:readline";
const lines = createInterface({ input: process.stdin });
const send = (message) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\n");
lines.on("line", (line) => {
  const request = JSON.parse(line);
  if (request.id === undefined) return;
  let result;
  if (request.method === "initialize") result = { protocolVersion: "2024-11-05", capabilities: { resources: {}, prompts: {} }, serverInfo: { name: "fixture" } };
  else if (request.method === "tools/list" && !request.params.cursor) result = { tools: [{ name: "first" }], nextCursor: "page-2" };
  else if (request.method === "tools/list") result = { tools: [{ name: "second" }] };
  else if (request.method === "resources/list") result = { resources: [{ uri: "file:///fixture.txt", name: "fixture" }] };
  else if (request.method === "resources/read") result = { contents: [{ uri: request.params.uri, text: "fixture body" }] };
  else if (request.method === "prompts/list") result = { prompts: [{ name: "brief" }] };
  else if (request.method === "prompts/get") result = { description: "brief", messages: [{ role: "user", content: { type: "text", text: "hello" } }] };
  else if (request.method === "tools/call") result = { content: [{ type: "text", text: request.params.name + " ok" }] };
  else { send({ id: request.id, error: { code: -32601, message: "not found" } }); return; }
  send({ id: request.id, result });
});
`;

test("MCP stdio client paginates tools and supports resources and prompts", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "asuka-mcp-client-"));
  const serverPath = join(dataDir, "server.mjs");
  writeFileSync(serverPath, serverSource, "utf8");
  const client = new McpStdioClient({ name: "fixture", command: process.execPath, args: [serverPath] });
  try {
    assert.deepEqual((await client.listTools()).map((tool) => tool.name), ["first", "second"]);
    assert.deepEqual(await client.listResources(), [{ uri: "file:///fixture.txt", name: "fixture" }]);
    assert.equal((await client.readResource("file:///fixture.txt")).contents[0].text, "fixture body");
    assert.deepEqual(await client.listPrompts(), [{ name: "brief" }]);
    assert.equal((await client.getPrompt("brief")).description, "brief");
    assert.equal((await client.callTool("fixture")).content[0].text, "fixture ok");
  } finally {
    client.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});
