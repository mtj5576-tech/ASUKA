import http from "node:http";
import https from "node:https";
import { spawn } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { handleCoreRequest } from "./server/core/router.mjs";
import { createAdapterRegistry } from "./server/adapters/registry.mjs";
import { ToolManager } from "./server/tools/tool-manager.mjs";
import { AsukaSettingsStore } from "./server/settings-store.mjs";
import { RoomVisualizer } from "./server/native/room-visualizer.mjs";

const defaultRoot = resolve(fileURLToPath(new URL("./dist", import.meta.url)));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "::1" || host.endsWith(".local")) return true;
  if (/^(127|10)\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) return true;
  return /^(fc|fd|fe8|fe9|fea|feb)/i.test(host);
}

function checkedOmbOrigin(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("OpenMausBot URL must use http or https");
  if (url.username || url.password) throw new Error("OpenMausBot URL cannot contain credentials");
  if (url.protocol === "http:" && !isPrivateHost(url.hostname)) throw new Error("Remote OpenMausBot URLs must use HTTPS");
  return new URL(url.origin);
}

function requestedOmbOrigin(request, fallback) {
  const requested = request.headers["x-asuka-omb-url"];
  return checkedOmbOrigin(Array.isArray(requested) ? requested[0] : requested || fallback.origin);
}

function ombLaunchCandidates() {
  const candidates = [];
  const app = process.env.OPENMAUSBOT_APP;
  if (app && existsSync(app)) candidates.push({ kind: "exe", path: app });
  for (const path of [
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Programs", "OpenMausBot", "OpenMausBot.exe"),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "OpenMausBot", "OpenMausBot.exe"),
  ].filter(Boolean)) {
    if (existsSync(path) && !candidates.some((candidate) => candidate.path === path)) candidates.push({ kind: "exe", path });
  }
  for (const source of [process.env.OPENMAUSBOT_SOURCE, "E:\\grok"].filter(Boolean)) {
    const command = join(source, "node_modules", ".bin", "electron.cmd");
    if (existsSync(command)) candidates.push({ kind: "source", path: command, cwd: source });
  }
  return candidates;
}

async function ombReachable(url) {
  try {
    const response = await fetch(`${url.replace(/\/+$/, "")}/api/health`, { signal: AbortSignal.timeout(1200) });
    const body = await response.json();
    return response.ok && body?.app === "openmausbot";
  } catch {
    return false;
  }
}

async function launchOpenMausBot() {
  for (const url of ["http://127.0.0.1:8799", "http://127.0.0.1:18799", "http://127.0.0.1:28799"]) {
    if (await ombReachable(url)) return { ok: true, alreadyRunning: true, url };
  }
  const candidate = ombLaunchCandidates()[0];
  if (!candidate) return { ok: false, error: "没有找到 OpenMausBot 启动路径", candidates: [] };

  if (candidate.kind === "exe") {
    spawn(candidate.path, [], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  } else {
    const command = `"${candidate.path}" .`;
    spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", command], {
      cwd: candidate.cwd,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref();
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
    for (const url of ["http://127.0.0.1:8799", "http://127.0.0.1:18799", "http://127.0.0.1:28799"]) {
      if (await ombReachable(url)) return { ok: true, alreadyRunning: false, url, candidate: candidate.kind };
    }
  }
  return { ok: false, error: "OpenMausBot 已启动，但 15 秒内没有就绪", candidates: ombLaunchCandidates().map((item) => item.path) };
}

function proxyRequest(origin, request, response) {
  const targetPath = request.url.replace(/^\/omb/, "") || "/";
  const headers = { ...request.headers, host: origin.host };
  delete headers["x-asuka-omb-url"];
  const transport = origin.protocol === "https:" ? https : http;
  const upstream = transport.request({
    protocol: origin.protocol,
    hostname: origin.hostname,
    port: origin.port || (origin.protocol === "https:" ? 443 : 80),
    path: targetPath,
    method: request.method,
    headers,
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on("error", (error) => {
    if (!response.headersSent) response.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: `OpenMausBot proxy failed: ${error.message}` }));
  });
  request.pipe(upstream);
}

export async function startAsukaServer(options = {}) {
  const root = resolve(options.root || defaultRoot);
  const initialOmbOrigin = checkedOmbOrigin(options.ombUrl || process.env.OMB_URL || "http://127.0.0.1:8799");
  const requestedPort = Number(options.port ?? process.env.PORT ?? 4173);
  const host = options.host || process.env.HOST || "127.0.0.1";
  const dataDir = resolve(options.dataDir || process.env.ASUKA_DATA_DIR || join(homedir(), ".asuka"));
  const workspaceDir = resolve(options.workspaceDir || process.env.ASUKA_WORKSPACE || process.cwd());
  const nativeDatabasePath = options.nativeDatabasePath || join(dataDir, "asuka-native.sqlite");
  const toolDatabasePath = options.toolDatabasePath || join(dataDir, "asuka-tools.sqlite");
  const settingsStore = options.settingsStore || new AsukaSettingsStore({
    dataDir,
    defaultWorkspace: workspaceDir,
    databasePaths: [nativeDatabasePath, toolDatabasePath],
  });
  const toolManager = options.toolManager || new ToolManager({
    dataDir,
    databasePath: toolDatabasePath,
    secretStore: options.secretStore,
    windowsMcpCommand: options.windowsMcpCommand,
    settingsStore,
  });
  const adapterRegistry = options.adapterRegistry || createAdapterRegistry({
    dataDir,
    workspaceDir,
    nativeAdapter: options.nativeAdapter,
    nativeDatabasePath,
    secretStore: options.secretStore,
    nativeProviderFactory: options.nativeProviderFactory,
    codexAdapter: options.codexAdapter,
    claudeAdapter: options.claudeAdapter,
    dshAdapter: options.dshAdapter,
    toolManager,
    settingsStore,
    skillsDir: options.skillsDir,
    maxToolRounds: options.maxToolRounds,
  });
  const nativeAdapter = adapterRegistry.nativeAdapter;
  if (!nativeAdapter.toolManager) nativeAdapter.toolManager = toolManager;
  nativeAdapter.toolManager?.setSkillLibrary?.(nativeAdapter.skillLibrary);
  const roomVisualizer = options.roomVisualizer || new RoomVisualizer({ dataDir });

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || host}`);
    if (await handleCoreRequest({ request, response, url, nativeAdapter, adapterRegistry, toolManager, settingsStore, roomVisualizer, resolveOrigin: (incoming) => requestedOmbOrigin(incoming, initialOmbOrigin) })) return;
    if (url.pathname === "/__asuka/omb-launch" && request.method === "GET") {
      json(response, 200, { candidates: ombLaunchCandidates().map((item) => ({ kind: item.kind, path: item.path })) });
      return;
    }
    if (url.pathname === "/__asuka/omb-launch" && request.method === "POST") {
      json(response, 200, await launchOpenMausBot());
      return;
    }
    if (url.pathname === "/__asuka/discover" && request.method === "GET") {
      const candidates = [...new Set([initialOmbOrigin.origin, "http://127.0.0.1:8799", "http://127.0.0.1:18799", "http://127.0.0.1:28799"])];
      const probes = await Promise.all(candidates.map(async (candidate) => {
        try {
          const health = await fetch(`${candidate}/api/health`, { signal: AbortSignal.timeout(1500) });
          const body = await health.json();
          return { url: candidate, reachable: health.ok && body?.app === "openmausbot", version: body?.version || null };
        } catch {
          return { url: candidate, reachable: false, version: null };
        }
      }));
      json(response, 200, { found: probes.find((probe) => probe.reachable) || null, candidates: probes });
      return;
    }
    if (url.pathname.startsWith("/omb/")) {
      let origin;
      try {
        origin = requestedOmbOrigin(request, initialOmbOrigin);
      } catch (error) {
        json(response, 400, { error: error instanceof Error ? error.message : String(error) });
        return;
      }
      proxyRequest(origin, request, response);
      return;
    }

    let relativePath;
    try {
      relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    } catch {
      response.writeHead(400, { "content-type": "text/plain; charset=utf-8" }).end("Bad Request");
      return;
    }

    let target = normalize(join(root, relativePath));
    const fromRoot = relative(root, target);
    if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    if (!existsSync(target) || statSync(target).isDirectory()) target = join(root, "index.html");
    if (!existsSync(target)) {
      response.writeHead(503, { "content-type": "text/plain; charset=utf-8" }).end("ASUKA has not been built. Run npm run build first.");
      return;
    }
    response.writeHead(200, {
      "content-type": mime[extname(target)] || "application/octet-stream",
      "cache-control": target.endsWith("index.html") ? "no-store" : "public, max-age=31536000, immutable",
    });
    createReadStream(target).pipe(response);
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(requestedPort, host, () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : requestedPort;
  const origin = `http://${host}:${port}`;
  return {
    server,
    origin,
    port,
    nativeAdapter,
    adapterRegistry,
    toolManager,
    settingsStore,
    close: () => new Promise((resolveClose) => server.close((error) => {
      if (!options.adapterRegistry) adapterRegistry.close();
      if (!options.toolManager) toolManager.close();
      resolveClose(error);
    })),
  };
}

function invokedDirectly() {
  if (!process.argv[1]) return false;
  return resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
}

if (invokedDirectly()) {
  startAsukaServer().then(({ origin }) => {
    console.log(`ASUKA running at ${origin}`);
    if (process.env.OMB_URL) console.log(`Optional OpenMausBot backend: ${process.env.OMB_URL}`);
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
