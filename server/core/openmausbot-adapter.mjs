import { randomUUID } from "node:crypto";

async function request(origin, path, options = {}) {
  const response = await fetch(new URL(path, origin), {
    method: options.method || "GET",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    const message = data && typeof data === "object" && data.error ? data.error : text || `OpenMausBot HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export class OpenMausBotAdapter {
  constructor(origin) {
    this.origin = origin;
  }

  async health() {
    return request(this.origin, "/api/health");
  }

  async snapshot() {
    const [health, botData, instanceData, config] = await Promise.all([
      request(this.origin, "/api/health"),
      request(this.origin, "/api/bots?messages=0"),
      request(this.origin, "/api/instances"),
      request(this.origin, "/api/config"),
    ]);
    return {
      backend: { kind: "openmausbot", version: health?.version || null, origin: this.origin, authOwner: "asuka", credentialSource: "openmausbot-adapter" },
      health,
      bots: botData?.bots || [],
      groups: botData?.groups || [],
      instances: instanceData?.instances || [],
      config,
    };
  }

  async getTask(threadId, limit = 80) {
    const [job, messageData] = await Promise.all([
      request(this.origin, `/api/threads/${encodeURIComponent(threadId)}/job`),
      request(this.origin, `/api/threads/${encodeURIComponent(threadId)}/messages?limit=${Math.max(1, Math.min(Number(limit) || 80, 200))}`),
    ]);
    return { threadId, job, messages: messageData?.messages || [] };
  }

  async stopTask({ kind, ownerId, threadId }) {
    if (!ownerId || !threadId) throw new Error("ownerId and threadId are required");
    if (kind === "room") {
      return request(this.origin, `/api/groups/${encodeURIComponent(ownerId)}/interrupt`, {
        method: "POST",
        body: { threadId, stopId: randomUUID() },
      });
    }
    return request(this.origin, `/api/bots/${encodeURIComponent(ownerId)}/interrupt`, {
      method: "POST",
      body: { threadId },
    });
  }

  async sendTask({ kind, ownerId, threadId, text, mode = "goal" }) {
    const value = String(text || "").trim();
    if (!ownerId || !threadId || !value) throw new Error("ownerId, threadId and text are required");
    if (kind === "room") {
      return request(this.origin, `/api/groups/${encodeURIComponent(ownerId)}/messages`, {
        method: "POST",
        body: { text: value, threadId, mode, sendId: randomUUID() },
      });
    }
    return request(this.origin, `/api/bots/${encodeURIComponent(ownerId)}/messages`, {
      method: "POST",
      body: { text: value, threadId, sendId: randomUUID() },
    });
  }

  async retryTask({ kind, ownerId, threadId }) {
    const messageData = await request(this.origin, `/api/threads/${encodeURIComponent(threadId)}/messages?limit=200`);
    const lastUser = [...(messageData?.messages || [])].reverse().find((message) => message.role === "user" && message.text);
    if (!lastUser?.text) throw new Error("this task has no user request to retry");
    return this.sendTask({ kind, ownerId, threadId, text: lastUser.text, mode: "goal" });
  }

  async updateAgent(agentId, patch, roomIds) {
    const updated = await request(this.origin, `/api/bots/${encodeURIComponent(agentId)}`, { method: "PATCH", body: patch });
    if (Array.isArray(roomIds)) {
      const state = await request(this.origin, "/api/bots?messages=0");
      for (const room of (state?.groups || []).filter((group) => group.section === "ASUKA")) {
        const members = room.memberIds || [];
        const has = members.includes(agentId);
        const shouldHave = roomIds.includes(room.id);
        if (has === shouldHave) continue;
        const memberIds = shouldHave ? [...new Set([...members, agentId])] : members.filter((id) => id !== agentId);
        await request(this.origin, `/api/groups/${encodeURIComponent(room.id)}`, { method: "PATCH", body: { memberIds } });
      }
    }
    return updated;
  }

  async createAgent(body) {
    const { roomId, approvalMode, ...payload } = body;
    const created = await request(this.origin, "/api/bots", { method: "POST", body: { ...payload, approvalMode: approvalMode || "ask" } });
    let bot = created?.bot;
    if (bot && approvalMode && bot.approvalMode !== approvalMode) {
      const patched = await request(this.origin, `/api/bots/${encodeURIComponent(bot.id)}`, { method: "PATCH", body: { approvalMode } });
      bot = patched?.bot || bot;
    }
    if (bot && roomId) {
      const state = await request(this.origin, "/api/bots?messages=0");
      const room = (state?.groups || []).find((group) => group.id === roomId);
      if (room && !(room.memberIds || []).includes(bot.id)) {
        await request(this.origin, `/api/groups/${encodeURIComponent(roomId)}`, { method: "PATCH", body: { memberIds: [...new Set([...(room.memberIds || []), bot.id])] } });
      }
    }
    return { bot };
  }

  async createRoom(body) {
    return request(this.origin, "/api/groups", { method: "POST", body });
  }

  async updateRoom(roomId, body) {
    return request(this.origin, `/api/groups/${encodeURIComponent(roomId)}`, { method: "PATCH", body });
  }

  async sendRoomMessage(roomId, body) {
    return request(this.origin, `/api/groups/${encodeURIComponent(roomId)}/messages`, { method: "POST", body: { ...body, sendId: body.sendId || randomUUID() } });
  }

  async respondApproval(threadId, body) {
    return request(this.origin, `/api/threads/${encodeURIComponent(threadId)}/respond`, { method: "POST", body });
  }

  async listSkills(agentId) {
    return request(this.origin, `/api/bots/${encodeURIComponent(agentId)}/skills`);
  }

  async getSkill(agentId, name) {
    return request(this.origin, `/api/bots/${encodeURIComponent(agentId)}/skills/${encodeURIComponent(name)}`);
  }

  async setSkill(agentId, name, enabled) {
    return request(this.origin, `/api/bots/${encodeURIComponent(agentId)}/skills/${encodeURIComponent(name)}`, { method: "PATCH", body: { enabled } });
  }

  async importSkill(agentId, source) {
    return request(this.origin, `/api/bots/${encodeURIComponent(agentId)}/skills`, { method: "POST", body: { source } });
  }

  async saveSkillTemplate(agentId, body) {
    return request(this.origin, `/api/bots/${encodeURIComponent(agentId)}/skill-template`, { method: "POST", body });
  }

  async removeSkill(agentId, name) {
    return request(this.origin, `/api/bots/${encodeURIComponent(agentId)}/skills/${encodeURIComponent(name)}`, { method: "DELETE" });
  }

  async testProvider(body) {
    return request(this.origin, "/api/keys/test", { method: "POST", body });
  }

  async updateProviderConfig(body) {
    return request(this.origin, "/api/config", { method: "PUT", body });
  }

  async addEndpoint(body) {
    return request(this.origin, "/api/instances/openai-compat", { method: "POST", body });
  }

  async refreshModels(instanceId) {
    return request(this.origin, `/api/instances/${encodeURIComponent(instanceId)}/refresh-models`, { method: "POST", body: {} });
  }

  async removeInstance(instanceId) {
    return request(this.origin, `/api/instances/${encodeURIComponent(instanceId)}`, { method: "DELETE" });
  }
}
