import { createExecutionAdapter } from "./execution-adapter.mjs";
import { createDecisionRecord } from "./decision-engine.mjs";
import { normalizeAdapterId } from "../adapters/registry.mjs";
import { createReport, fabricTask } from "../fabric/task-fabric.mjs";
import { ROLE_MANIFESTS } from "../../shared/decision/roles.mjs";

async function readJson(request, limit = 64 * 1024) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > limit) throw new Error("request body is too large");
  }
  if (!body) return {};
  const value = JSON.parse(body);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("body must be a JSON object");
  return value;
}

function send(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

function sendHtml(response, status, html) {
  response.writeHead(status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(html);
}

export async function handleCoreRequest({ request, response, url, resolveOrigin, nativeAdapter, adapterRegistry, toolManager, settingsStore, roomVisualizer }) {
  if (!url.pathname.startsWith("/__asuka/core/")) return false;
  try {
    if (request.method === "GET" && url.pathname === "/__asuka/core/roles") {
      send(response, 200, { roles: ROLE_MANIFESTS });
      return true;
    }
    if (request.method === "POST" && url.pathname === "/__asuka/core/decide") {
      send(response, 200, createDecisionRecord(await readJson(request)));
      return true;
    }
    if (request.method === "GET" && url.pathname === "/__asuka/core/adapters") {
      const probeOmb = url.searchParams.get("probe") === "openmausbot";
      send(response, 200, { adapters: await adapterRegistry.descriptors(probeOmb ? resolveOrigin(request) : null, { probeOmb }) });
      return true;
    }
    if (url.pathname === "/__asuka/core/settings") {
      if (!settingsStore) throw new Error("settings store is unavailable");
      if (request.method === "GET") {
        send(response, 200, settingsStore.snapshot());
        return true;
      }
      if (request.method === "PATCH") {
        settingsStore.update(await readJson(request));
        send(response, 200, settingsStore.snapshot());
        return true;
      }
    }
    if (url.pathname.startsWith("/__asuka/core/tools")) {
      if (!toolManager) throw new Error("tool manager is unavailable");
      if (request.method === "GET" && url.pathname === "/__asuka/core/tools") {
        send(response, 200, { servers: toolManager.listServers(), approvals: toolManager.listApprovals(), audit: toolManager.listAudit(50) });
        return true;
      }
      if (request.method === "POST" && url.pathname === "/__asuka/core/tools/servers") {
        send(response, 201, { server: toolManager.saveServer(await readJson(request)) });
        return true;
      }
      let match = /^\/__asuka\/core\/tools\/servers\/([\w-]+)$/.exec(url.pathname);
      if (match && request.method === "DELETE") {
        send(response, 200, toolManager.removeServer(match[1]));
        return true;
      }
      match = /^\/__asuka\/core\/tools\/servers\/([\w-]+)\/connect$/.exec(url.pathname);
      if (match && request.method === "POST") {
        const tools = await toolManager.listTools(match[1]);
        send(response, 200, { serverId: match[1], tools });
        return true;
      }
      match = /^\/__asuka\/core\/tools\/servers\/([\w-]+)\/tools$/.exec(url.pathname);
      if (match && request.method === "GET") {
        send(response, 200, { serverId: match[1], tools: await toolManager.listTools(match[1]) });
        return true;
      }
      match = /^\/__asuka\/core\/tools\/servers\/([\w-]+)\/resources$/.exec(url.pathname);
      if (match && request.method === "GET") {
        send(response, 200, { serverId: match[1], resources: await toolManager.listResources(match[1]) });
        return true;
      }
      match = /^\/__asuka\/core\/tools\/servers\/([\w-]+)\/prompts$/.exec(url.pathname);
      if (match && request.method === "GET") {
        send(response, 200, { serverId: match[1], prompts: await toolManager.listPrompts(match[1]) });
        return true;
      }
      if (request.method === "POST" && url.pathname === "/__asuka/core/tools/resources/read") {
        const body = await readJson(request);
        send(response, 200, await toolManager.readResource(body.serverId, body.uri));
        return true;
      }
      if (request.method === "POST" && url.pathname === "/__asuka/core/tools/prompts/get") {
        const body = await readJson(request);
        send(response, 200, await toolManager.getPrompt(body.serverId, body.name, body.args));
        return true;
      }
      if (request.method === "POST" && url.pathname === "/__asuka/core/tools/approvals") {
        const body = await readJson(request);
        send(response, 201, { approval: await toolManager.createApproval(body) });
        return true;
      }
      match = /^\/__asuka\/core\/tools\/approvals\/([\w-]+)\/decide$/.exec(url.pathname);
      if (match && request.method === "POST") {
        const body = await readJson(request);
        send(response, 200, { approval: toolManager.decideApproval(match[1], Boolean(body.approved)) });
        return true;
      }
      if (request.method === "POST" && url.pathname === "/__asuka/core/tools/call") {
        const body = await readJson(request);
        send(response, 200, await toolManager.call(body));
        return true;
      }
      if (request.method === "GET" && url.pathname === "/__asuka/core/tools/audit") {
        send(response, 200, { audit: toolManager.listAudit(Math.min(Number(url.searchParams.get("limit")) || 100, 200)) });
        return true;
      }
    }
    if (url.pathname.startsWith("/__asuka/core/native/provider")) {
      if (!nativeAdapter) throw new Error("native adapter is unavailable");
      if (request.method === "GET" && url.pathname === "/__asuka/core/native/provider") {
        send(response, 200, { provider: nativeAdapter.providerInfo() });
        return true;
      }
      if (request.method === "PUT" && url.pathname === "/__asuka/core/native/provider") {
        send(response, 200, { provider: nativeAdapter.saveProvider(await readJson(request)) });
        return true;
      }
      if (request.method === "DELETE" && url.pathname === "/__asuka/core/native/provider") {
        send(response, 200, { provider: nativeAdapter.clearProvider() });
        return true;
      }
      if (request.method === "POST" && url.pathname === "/__asuka/core/native/provider/test") {
        send(response, 200, await nativeAdapter.testProvider(await readJson(request)));
        return true;
      }
      if (request.method === "POST" && url.pathname === "/__asuka/core/native/provider/models") {
        send(response, 200, await nativeAdapter.providerModels(await readJson(request)));
        return true;
      }
    }
    if (url.pathname === "/__asuka/core/events") {
      if (!nativeAdapter) throw new Error("native event bus is unavailable");
      if (request.method === "GET") {
        send(response, 200, { events: nativeAdapter.listEvents({
          taskId: url.searchParams.get("taskId") || "",
          limit: Math.min(Number(url.searchParams.get("limit")) || 100, 500),
        }) });
        return true;
      }
      if (request.method === "POST") {
        send(response, 202, await nativeAdapter.emitEvent(await readJson(request)));
        return true;
      }
    }
    const adapterKind = normalizeAdapterId(url.searchParams.get("adapter") || request.headers["x-asuka-adapter"] || process.env.ASUKA_ADAPTER || "native");
    if (request.method === "GET" && url.pathname === "/__asuka/core/auth") {
      const probeOmb = adapterKind === "openmausbot";
      const adapters = await adapterRegistry.descriptors(probeOmb ? resolveOrigin(request) : null, { probeOmb });
      const selected = adapters.find((adapter) => adapter.id === adapterKind);
      send(response, 200, {
        owner: "asuka",
        adapter: adapterKind,
        available: Boolean(selected?.available),
        credentialSource: selected?.credentialSource || null,
      });
      return true;
    }
    const adapter = createExecutionAdapter(adapterKind, {
      registry: adapterRegistry,
      resolveOrigin: resolveOrigin(request),
    });
    if (request.method === "GET" && url.pathname === "/__asuka/core/fabric") {
      if (typeof adapter.fabricSnapshot === "function") {
        send(response, 200, adapter.fabricSnapshot());
      } else {
        const snapshot = await adapter.snapshot();
        const tasks = (snapshot.groups || []).flatMap((group) => (group.tasks || []).map((task) => fabricTask({
          ...task,
          kind: "room",
          ownerId: group.id,
          status: task.activity || (task.working ? "running" : "idle"),
          mandate: { adapter: adapterKind, scope: task.title, source: "adapter-snapshot" },
          report: createReport({ state: task.activity === "completed" ? "ready" : task.activity === "failed" ? "failed" : task.working ? "progress" : "waiting", summary: task.title, adapter: adapterKind }),
        })));
        send(response, 200, { version: "1.0.0", adapter: adapterKind, authOwner: "asuka", tasks, lanes: {}, partial: true });
      }
      return true;
    }
    if (request.method === "GET" && url.pathname === "/__asuka/core/health") {
      send(response, 200, await adapter.health());
      return true;
    }
    if (request.method === "GET" && url.pathname === "/__asuka/core/snapshot") {
      send(response, 200, await adapter.snapshot());
      return true;
    }
    let match = /^\/__asuka\/core\/rooms\/([\w-]+)\/architecture$/.exec(url.pathname);
    if (request.method === "GET" && match) {
      if (!roomVisualizer) throw new Error("room visualization is unavailable");
      const html = await roomVisualizer.render(await adapter.snapshot(), match[1], { force: url.searchParams.get("refresh") === "1" });
      sendHtml(response, 200, html);
      return true;
    }
    if (request.method === "POST" && url.pathname === "/__asuka/core/agents") {
      send(response, 201, await adapter.createAgent(await readJson(request)));
      return true;
    }
    if (request.method === "POST" && url.pathname === "/__asuka/core/rooms") {
      send(response, 201, await adapter.createRoom(await readJson(request)));
      return true;
    }
    match = /^\/__asuka\/core\/rooms\/([\w-]+)$/.exec(url.pathname);
    if (request.method === "PATCH" && match) {
      send(response, 200, await adapter.updateRoom(match[1], await readJson(request)));
      return true;
    }
    match = /^\/__asuka\/core\/rooms\/([\w-]+)\/messages$/.exec(url.pathname);
    if (request.method === "POST" && match) {
      send(response, 202, await adapter.sendRoomMessage(match[1], await readJson(request)));
      return true;
    }
    match = /^\/__asuka\/core\/approvals\/([\w-]+)\/respond$/.exec(url.pathname);
    if (request.method === "POST" && match) {
      send(response, 200, await adapter.respondApproval(match[1], await readJson(request)));
      return true;
    }
    match = /^\/__asuka\/core\/agents\/([\w-]+)\/skill-template$/.exec(url.pathname);
    if (request.method === "POST" && match) {
      send(response, 201, await adapter.saveSkillTemplate(match[1], await readJson(request)));
      return true;
    }
    match = /^\/__asuka\/core\/agents\/([\w-]+)\/skills$/.exec(url.pathname);
    if (match && request.method === "GET") {
      send(response, 200, await adapter.listSkills(match[1]));
      return true;
    }
    if (match && request.method === "POST") {
      const body = await readJson(request);
      send(response, 201, await adapter.importSkill(match[1], body.source));
      return true;
    }
    match = /^\/__asuka\/core\/agents\/([\w-]+)\/skills\/([a-z0-9-]+)$/.exec(url.pathname);
    if (match && request.method === "GET") {
      send(response, 200, await adapter.getSkill(match[1], match[2]));
      return true;
    }
    if (match && request.method === "PATCH") {
      const body = await readJson(request);
      send(response, 200, await adapter.setSkill(match[1], match[2], body.enabled));
      return true;
    }
    if (match && request.method === "DELETE") {
      send(response, 200, await adapter.removeSkill(match[1], match[2]));
      return true;
    }
    match = /^\/__asuka\/core\/agents\/([\w-]+)\/kernel$/.exec(url.pathname);
    if (match && request.method === "GET") {
      if (typeof adapter.getAgentKernelThread !== "function") {
        send(response, 404, { error: "Agent Kernel is not supported by this adapter" });
      } else {
        send(response, 200, adapter.getAgentKernelThread(
          match[1],
          url.searchParams.get("taskId") || "",
          url.searchParams.get("purpose") || "contributor",
        ));
      }
      return true;
    }
    if (request.method === "POST" && url.pathname === "/__asuka/core/providers/test") {
      send(response, 200, await adapter.testProvider(await readJson(request)));
      return true;
    }
    if (request.method === "PUT" && url.pathname === "/__asuka/core/providers/config") {
      send(response, 200, await adapter.updateProviderConfig(await readJson(request)));
      return true;
    }
    if (request.method === "POST" && url.pathname === "/__asuka/core/endpoints") {
      send(response, 201, await adapter.addEndpoint(await readJson(request)));
      return true;
    }
    match = /^\/__asuka\/core\/instances\/([\w.-]+)\/refresh-models$/.exec(url.pathname);
    if (request.method === "POST" && match) {
      send(response, 200, await adapter.refreshModels(match[1]));
      return true;
    }
    match = /^\/__asuka\/core\/instances\/([\w.-]+)$/.exec(url.pathname);
    if (request.method === "DELETE" && match) {
      send(response, 200, await adapter.removeInstance(match[1]));
      return true;
    }
    match = /^\/__asuka\/core\/tasks\/([\w-]+)$/.exec(url.pathname);
    if (request.method === "PATCH" && match) {
      if (typeof adapter.updateTaskSettings !== "function") {
        send(response, 404, { error: "task settings are not supported by this adapter" });
      } else {
        send(response, 200, adapter.updateTaskSettings(match[1], await readJson(request)));
      }
      return true;
    }
    if (request.method === "GET" && match) {
      send(response, 200, await adapter.getTask(match[1], url.searchParams.get("limit")));
      return true;
    }
    if (request.method === "DELETE" && match) {
      if (typeof adapter.deleteTask !== "function") {
        send(response, 404, { error: "permanent task deletion is not supported by this adapter" });
      } else {
        send(response, 200, await adapter.deleteTask(match[1]));
      }
      return true;
    }
    match = /^\/__asuka\/core\/tasks\/([\w-]+)\/fork$/.exec(url.pathname);
    if (request.method === "POST" && match) {
      if (typeof adapter.forkTask !== "function") {
        send(response, 404, { error: "task forking is not supported by this adapter" });
      } else {
        send(response, 201, await adapter.forkTask(match[1]));
      }
      return true;
    }
    match = /^\/__asuka\/core\/tasks\/([\w-]+)\/events$/.exec(url.pathname);
    if (request.method === "GET" && match) {
      if (typeof adapter.subscribeTaskEvents !== "function") {
        send(response, 404, { error: "task event stream is not supported by this adapter" });
      } else {
        adapter.subscribeTaskEvents(match[1], request, response);
      }
      return true;
    }
    match = /^\/__asuka\/core\/tasks\/([\w-]+)\/stop$/.exec(url.pathname);
    if (request.method === "POST" && match) {
      const body = await readJson(request);
      send(response, 200, await adapter.stopTask({ kind: body.kind, ownerId: body.ownerId, threadId: match[1] }));
      return true;
    }
    match = /^\/__asuka\/core\/tasks\/([\w-]+)\/guidance$/.exec(url.pathname);
    if (request.method === "POST" && match) {
      const body = await readJson(request);
      if (typeof adapter.guideTask !== "function") {
        send(response, 404, { error: "task guidance is not supported by this adapter" });
      } else {
        send(response, 202, await adapter.guideTask({ threadId: match[1], text: body.text }));
      }
      return true;
    }
    match = /^\/__asuka\/core\/tasks\/([\w-]+)\/retry$/.exec(url.pathname);
    if (request.method === "POST" && match) {
      const body = await readJson(request);
      if (typeof adapter.retryTask !== "function") {
        send(response, 404, { error: "task retry is not supported by this adapter" });
      } else {
        send(response, 202, await adapter.retryTask({ kind: body.kind, ownerId: body.ownerId, threadId: match[1] }));
      }
      return true;
    }
    match = /^\/__asuka\/core\/tasks\/([\w-]+)\/messages$/.exec(url.pathname);
    if (request.method === "POST" && match) {
      const body = await readJson(request);
      send(response, 202, await adapter.sendTask({ kind: body.kind, ownerId: body.ownerId, threadId: match[1], text: body.text, mode: body.mode }));
      return true;
    }
    match = /^\/__asuka\/core\/agents\/([\w-]+)$/.exec(url.pathname);
    if (request.method === "PATCH" && match) {
      const body = await readJson(request);
      if (!body.patch || typeof body.patch !== "object" || Array.isArray(body.patch)) throw new Error("patch must be an object");
      send(response, 200, await adapter.updateAgent(match[1], body.patch, body.roomIds));
      return true;
    }
    send(response, 404, { error: "unknown ASUKA Core route" });
  } catch (error) {
    send(response, 400, { error: error instanceof Error ? error.message : String(error) });
  }
  return true;
}
