import { randomUUID } from "node:crypto";

import { policyForAgent, toolAllowedByPolicy } from "./bot-policy.mjs";

const THREAD_ENTITY = "agent-kernel-thread";
const MAX_EVENT_ROWS = 240;
const MAX_THREAD_MESSAGES = 80;

function now() {
  return new Date().toISOString();
}

function text(value, limit = 60_000) {
  return String(value || "").slice(0, limit);
}

function parseArguments(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function mcpResultParts(result) {
  const content = Array.isArray(result?.content) ? result.content : [];
  const parts = content.map((item) => {
    if (item?.type === "text") return item.text || "";
    if (item?.type === "image") return `[image ${item.mimeType || "image/png"}]`;
    if (item?.type === "resource") return JSON.stringify(item.resource || item);
    return JSON.stringify(item);
  }).filter(Boolean);
  const images = content.filter((item) => item?.type === "image" && item.data)
    .slice(0, 2)
    .map((item) => ({ mimeType: item.mimeType || "image/png", data: item.data }));
  const structured = result?.structuredContent ? `\n${JSON.stringify(result.structuredContent).slice(0, 20_000)}` : "";
  return {
    text: text(`${parts.join("\n") || "Tool completed without text output."}${structured}`, 50_000),
    images,
  };
}

function publicThread(thread) {
  return {
    version: thread.version,
    id: thread.id,
    taskId: thread.taskId,
    botId: thread.botId,
    botName: thread.botName,
    purpose: thread.purpose,
    status: thread.status,
    policy: thread.policy,
    turns: thread.turns.length,
    events: thread.events.length,
    messageCount: thread.messages.length,
    toolCalls: thread.stats.toolCalls,
    toolFailures: thread.stats.toolFailures,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

function compactMessages(messages, maxChars) {
  const total = messages.reduce((sum, message) => sum + text(message.content).length, 0);
  if (total <= maxChars && messages.length <= MAX_THREAD_MESSAGES) return { messages, compacted: false };
  const first = messages[0] ? [{ ...messages[0], content: text(messages[0].content, 8_000) }] : [];
  const recent = messages.slice(-24).map((message) => {
    if (message.role === "tool") {
      return { ...message, content: text(message.content, 2_000), images: (message.images || []).slice(0, 1) };
    }
    return { ...message, content: text(message.content, 16_000) };
  });
  return { messages: [...first, ...recent], compacted: true };
}

export class AgentKernel {
  constructor(options = {}) {
    this.store = options.store;
    this.clientForAgent = options.clientForAgent;
    this.toolManager = options.toolManager || null;
    this.recordTaskEvent = options.recordTaskEvent || (() => null);
    if (!this.store) throw new Error("AgentKernel requires a store");
    if (typeof this.clientForAgent !== "function") throw new Error("AgentKernel requires clientForAgent");
    this.markRunningInterrupted();
  }

  threadId(taskId, agentId, purpose = "contributor") {
    return `${taskId}:${agentId}:${purpose}`;
  }

  readThread(taskId, agentId, purpose = "contributor") {
    return this.store.getEntity(THREAD_ENTITY, this.threadId(taskId, agentId, purpose));
  }

  listThreads(taskId = "") {
    return this.store.listEntities(THREAD_ENTITY)
      .filter((thread) => !taskId || thread.taskId === taskId)
      .map(publicThread);
  }

  markRunningInterrupted() {
    for (const thread of this.store.listEntities(THREAD_ENTITY)) {
      if (thread.status !== "running") continue;
      thread.status = "interrupted";
      thread.lastError = "ASUKA restarted before the Bot thread completed.";
      thread.updatedAt = now();
      this.appendEvent(thread, "thread.interrupted", { reason: thread.lastError });
      this.store.putEntity(THREAD_ENTITY, thread.id, thread);
    }
  }

  ensureThread({ taskId, agent, purpose, policy }) {
    const id = this.threadId(taskId, agent.id, purpose);
    const existing = this.store.getEntity(THREAD_ENTITY, id);
    if (existing) {
      existing.botName = agent.name || existing.botName;
      existing.policy = policy;
      existing.updatedAt = now();
      return existing;
    }
    const at = now();
    return {
      version: "1.0.0",
      id,
      taskId,
      botId: agent.id,
      botName: agent.name || agent.id,
      purpose,
      status: "idle",
      policy,
      messages: [],
      turns: [],
      events: [],
      stats: { modelTurns: 0, toolCalls: 0, toolFailures: 0, inputChars: 0, outputChars: 0 },
      createdAt: at,
      updatedAt: at,
    };
  }

  saveThread(thread) {
    thread.updatedAt = now();
    this.store.putEntity(THREAD_ENTITY, thread.id, thread);
    return thread;
  }

  appendEvent(thread, type, payload = {}) {
    thread.events.push({ id: randomUUID(), type, payload, at: now() });
    if (thread.events.length > MAX_EVENT_ROWS) thread.events.splice(0, thread.events.length - MAX_EVENT_ROWS);
  }

  appendMessage(thread, message) {
    thread.messages.push({ ...message, at: message.at || now() });
    const compacted = compactMessages(thread.messages, thread.policy.maxContextChars);
    thread.messages = compacted.messages;
    if (compacted.compacted) this.appendEvent(thread, "context.compacted", { messageCount: thread.messages.length });
  }

  async executeTool({ taskId, agent, thread, call, executeTool, policy }) {
    const args = parseArguments(call.arguments);
    const tool = this.toolManager ? await this.toolManager.resolveModelTool(call.name) : null;
    if (!tool) throw new Error(`Unknown Agent Kernel tool: ${call.name}`);
    const risk = this.toolManager?.riskForTool ? this.toolManager.riskForTool(tool, args) : "confirm";
    const candidate = { ...tool, risk };
    if (!toolAllowedByPolicy(policy, candidate)) {
      return {
        status: "blocked",
        text: `Tool ${call.name} is blocked by ${agent.name}'s ${policy.toolMode} policy.`,
        risk,
      };
    }
    if (typeof executeTool === "function") {
      return executeTool({ taskId, agent, thread, call, args, tool: candidate, policy });
    }
    if (risk !== "safe") {
      return { status: "approval-required", text: `Tool ${call.name} requires primary Worker approval.`, risk };
    }
    const execution = await this.toolManager.callModel({ taskId, modelName: call.name, args });
    return { status: "completed", ...mcpResultParts(execution.result), risk, durationMs: execution.durationMs };
  }

  async run(input = {}) {
    const taskId = text(input.taskId, 200);
    const agent = input.agent;
    if (!taskId) throw new Error("AgentKernel taskId is required");
    if (!agent?.id) throw new Error("AgentKernel agent is required");
    const purpose = text(input.purpose, 40) || "contributor";
    const policy = input.policy || policyForAgent(agent, { purpose, ...(input.policyOptions || {}) });
    const thread = this.ensureThread({ taskId, agent, purpose, policy });
    const turnId = randomUUID();
    const startedAt = now();
    const turn = { id: turnId, status: "running", startedAt, completedAt: null, outputChars: 0, toolCalls: 0 };
    thread.status = "running";
    thread.turns.push(turn);
    this.appendEvent(thread, "turn.started", { turnId, purpose });
    this.saveThread(thread);
    this.recordTaskEvent(taskId, "agent.kernel.started", { threadId: thread.id, botId: agent.id, botName: agent.name, purpose, policy });

    const supplied = Array.isArray(input.messages) ? input.messages : [];
    for (const message of supplied) {
      if (!message?.role || !message?.content) continue;
      this.appendMessage(thread, {
        role: message.role,
        content: text(message.content, 40_000),
        images: Array.isArray(message.images) ? message.images.slice(0, 2) : [],
      });
    }
    const client = this.clientForAgent(agent.id);
    const maxRounds = Math.max(1, Number(input.maxRounds) || policy.maxRounds);
    let output = "";
    let totalToolCalls = 0;
    try {
      for (let round = 0; round < maxRounds; round += 1) {
        if (input.signal?.aborted) throw new DOMException("The operation was aborted", "AbortError");
        const response = await client.generate({
          system: input.system || "",
          messages: thread.messages,
          tools: Array.isArray(input.tools) ? input.tools : [],
          maxTokens: Math.max(256, Number(input.maxTokens) || 1_200),
          signal: input.signal,
          onText: input.onText,
        });
        thread.stats.modelTurns += 1;
        thread.stats.outputChars += text(response.text).length;
        const toolCalls = Array.isArray(response.toolCalls) ? response.toolCalls : [];
        this.appendMessage(thread, {
          role: "assistant",
          content: text(response.text, 40_000),
          tool_calls: toolCalls.map((call) => ({
            id: call.id,
            name: call.name,
            arguments: typeof call.arguments === "string" ? call.arguments : JSON.stringify(call.arguments || {}),
          })),
        });
        turn.toolCalls += toolCalls.length;
        totalToolCalls += toolCalls.length;
        if (!policy.toolsEnabled || !toolCalls.length) {
          const rawOutput = text(response.text).trim();
          output = text(rawOutput, policy.maxOutputChars).trim();
          if (output.length < rawOutput.length) this.appendEvent(thread, "output.bounded", { turnId, originalChars: rawOutput.length, maxOutputChars: policy.maxOutputChars });
          break;
        }
        if (totalToolCalls > policy.maxToolCallsPerTurn * maxRounds) {
          throw new Error("Agent Kernel exceeded its tool-call budget");
        }
        const selectedCalls = toolCalls.slice(0, policy.maxToolCallsPerTurn);
        for (const call of selectedCalls) {
          this.appendEvent(thread, "tool.requested", { turnId, callId: call.id, name: call.name });
          this.recordTaskEvent(taskId, "agent.kernel.tool.requested", { threadId: thread.id, botId: agent.id, callId: call.id, name: call.name });
          try {
            const result = await this.executeTool({
              taskId,
              agent,
              thread,
              call,
              executeTool: input.executeTool,
              policy,
            });
            const resultText = text(result?.text || `Tool ${call.name} completed.`);
            this.appendMessage(thread, {
              role: "tool",
              tool_call_id: call.id,
              name: call.name,
              content: resultText,
              images: Array.isArray(result?.images) ? result.images : [],
            });
            thread.stats.toolCalls += 1;
            this.appendEvent(thread, "tool.completed", { turnId, callId: call.id, name: call.name, status: result?.status || "completed", risk: result?.risk || "safe" });
            this.recordTaskEvent(taskId, "agent.kernel.tool.completed", { threadId: thread.id, botId: agent.id, callId: call.id, name: call.name, result: resultText.slice(0, 4_000) });
            if (result?.status === "approval-required") {
              thread.status = "waiting-approval";
              turn.status = "waiting-approval";
              this.appendEvent(thread, "approval.required", { turnId, callId: call.id, name: call.name });
              this.saveThread(thread);
              return {
                status: "waiting-approval",
                output: "",
                thread: publicThread(thread),
                toolEvidence: thread.messages.filter((message) => message.role === "tool").slice(-20),
              };
            }
            if (result?.status === "blocked") this.appendEvent(thread, "tool.blocked", { turnId, callId: call.id, name: call.name });
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            thread.stats.toolFailures += 1;
            this.appendMessage(thread, {
              role: "tool",
              tool_call_id: call.id,
              name: call.name,
              content: `Tool failed: ${reason}`,
            });
            this.appendEvent(thread, "tool.failed", { turnId, callId: call.id, name: call.name, error: reason });
            this.recordTaskEvent(taskId, "agent.kernel.tool.failed", { threadId: thread.id, botId: agent.id, callId: call.id, name: call.name, error: reason });
          }
        }
        for (const call of toolCalls.slice(policy.maxToolCallsPerTurn)) {
          this.appendMessage(thread, {
            role: "tool",
            tool_call_id: call.id,
            name: call.name,
            content: "Tool call deferred by the Agent Kernel per-turn budget.",
          });
        }
        this.saveThread(thread);
      }
      if (!output && thread.messages.at(-1)?.role !== "assistant") {
        output = thread.messages.filter((message) => message.role === "assistant").at(-1)?.content || "";
      }
      thread.status = output ? "completed" : "failed";
      turn.status = thread.status;
      turn.completedAt = now();
      turn.outputChars = output.length;
      this.appendEvent(thread, output ? "turn.completed" : "turn.failed", { turnId, outputChars: output.length });
      this.saveThread(thread);
      this.recordTaskEvent(taskId, "agent.kernel.completed", { threadId: thread.id, botId: agent.id, purpose, status: thread.status, toolCalls: turn.toolCalls });
      return {
        status: thread.status,
        output,
        thread: publicThread(thread),
        messages: thread.messages,
        toolEvidence: thread.messages.filter((message) => message.role === "tool").slice(-20),
      };
    } catch (error) {
      thread.status = input.signal?.aborted ? "cancelled" : "failed";
      thread.lastError = error instanceof Error ? error.message : String(error);
      turn.status = thread.status;
      turn.completedAt = now();
      this.appendEvent(thread, "turn.failed", { turnId, error: thread.lastError });
      this.saveThread(thread);
      this.recordTaskEvent(taskId, "agent.kernel.failed", { threadId: thread.id, botId: agent.id, purpose, status: thread.status, error: thread.lastError });
      throw error;
    }
  }
}

export { THREAD_ENTITY };
