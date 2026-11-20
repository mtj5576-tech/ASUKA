function trimBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function signalWithTimeout(signal, timeoutMs) {
  const signals = [AbortSignal.timeout(timeoutMs)];
  if (signal) signals.push(signal);
  return AbortSignal.any(signals);
}

async function responseError(response) {
  const text = await response.text();
  let detail = text;
  try {
    const data = JSON.parse(text);
    detail = data?.error?.message || data?.error || data?.message || text;
  } catch {
    // Keep the provider's raw response when it is not JSON.
  }
  return new Error(`Provider HTTP ${response.status}${detail ? `: ${String(detail).slice(0, 500)}` : ""}`);
}

function parseArguments(value, fallback = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function imageBlocks(images = []) {
  return images.map((image) => ({
    type: "image",
    mimeType: image.mimeType || "image/png",
    data: image.data || "",
  })).filter((image) => image.data);
}

function openAiContent(content, images = []) {
  if (!images.length) return content || "";
  return [
    { type: "text", text: typeof content === "string" ? content : "" },
    ...images.map((image) => ({
      type: "image_url",
      image_url: { url: `data:${image.mimeType || "image/png"};base64,${image.data}` },
    })),
  ];
}

function openAiMessages(system, messages) {
  const output = [{ role: "system", content: system }];
  for (const message of messages) {
    const images = imageBlocks(message.images);
    if (message.role === "tool") {
      output.push({ role: "tool", tool_call_id: message.tool_call_id, content: message.content || "" });
      if (images.length) output.push({ role: "user", content: openAiContent("Tool result image follows.", images) });
      continue;
    }
    if (message.role === "assistant") {
      const assistant = { role: "assistant", content: message.content || "" };
      const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
      if (toolCalls.length) {
        assistant.tool_calls = toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: typeof call.arguments === "string" ? call.arguments : JSON.stringify(call.arguments || {}) },
        }));
      }
      output.push(assistant);
      continue;
    }
    output.push({ role: "user", content: openAiContent(message.content, images) });
  }
  return output;
}

function openAiTools(tools = []) {
  return tools.map((tool) => {
    if (tool?.type === "function" && tool.function) return tool;
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description || "",
        parameters: tool.parameters?.type === "object" ? tool.parameters : { type: "object", properties: {} },
      },
    };
  }).filter((tool) => tool.function?.name);
}

function anthropicContent(content, images = []) {
  const blocks = [{ type: "text", text: typeof content === "string" ? content : JSON.stringify(content || "") }];
  for (const image of imageBlocks(images)) {
    blocks.push({ type: "image", source: { type: "base64", media_type: image.mimeType, data: image.data } });
  }
  return blocks;
}

function anthropicMessages(messages) {
  const output = [];
  for (const message of messages) {
    if (message.role === "tool") {
      const resultImages = imageBlocks(message.images).map((image) => ({
        type: "image",
        source: { type: "base64", media_type: image.mimeType, data: image.data },
      }));
      output.push({
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: message.tool_call_id,
          content: [{ type: "text", text: message.content || "" }, ...resultImages],
        }],
      });
      continue;
    }
    if (message.role === "assistant") {
      const blocks = [];
      if (message.content) blocks.push({ type: "text", text: message.content });
      for (const call of Array.isArray(message.tool_calls) ? message.tool_calls : []) {
        blocks.push({ type: "tool_use", id: call.id, name: call.name, input: parseArguments(call.arguments) });
      }
      output.push({ role: "assistant", content: blocks.length ? blocks : [{ type: "text", text: "" }] });
      continue;
    }
    output.push({ role: "user", content: anthropicContent(message.content, message.images) });
  }
  const merged = [];
  for (const message of output) {
    const previous = merged[merged.length - 1];
    if (previous?.role === message.role && Array.isArray(previous.content) && Array.isArray(message.content)) {
      previous.content.push(...message.content);
    } else {
      merged.push(message);
    }
  }
  return merged;
}

async function consumeSse(response, onEvent) {
  if (!response.body) throw new Error("Provider returned an empty streaming response");
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let boundary = buffer.search(/\r?\n\r?\n/);
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + (buffer[boundary] === "\r" ? 4 : 2));
      const data = block.split(/\r?\n/).filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) await onEvent(data);
      boundary = buffer.search(/\r?\n\r?\n/);
    }
  }
  buffer += decoder.decode();
  const data = buffer.split(/\r?\n/).filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (data) await onEvent(data);
}

function parseJson(data) {
  try {
    return JSON.parse(data);
  } catch {
    throw new Error("Provider stream returned invalid JSON");
  }
}

export class OpenAICompatibleClient {
  constructor(config) {
    this.kind = "openai-compatible";
    this.baseUrl = trimBaseUrl(config.baseUrl || "https://api.openai.com/v1");
    this.model = config.model;
    this.apiKey = config.apiKey;
  }

  headers() {
    return {
      "content-type": "application/json",
      authorization: `Bearer ${this.apiKey}`,
    };
  }

  async generate({ system, messages, tools = [], maxTokens = 4096, responseFormat = null, signal, onText }) {
    const body = {
      model: this.model,
      stream: !responseFormat,
      max_tokens: maxTokens,
      messages: openAiMessages(system, messages),
    };
    if (tools.length) body.tools = openAiTools(tools);
    if (responseFormat) body.response_format = responseFormat;
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      signal: signalWithTimeout(signal, 10 * 60_000),
      body: JSON.stringify(body),
    });
    if (!response.ok) throw await responseError(response);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) {
      const data = await response.json();
      const choice = data?.choices?.[0] || {};
      const message = choice.message || {};
      const text = message.content || "";
      if (text) await onText?.(text);
      return {
        text,
        usage: data?.usage || null,
        finishReason: choice.finish_reason || "",
        toolCalls: (message.tool_calls || []).map((call) => ({
          id: call.id,
          name: call.function?.name,
          arguments: call.function?.arguments || "{}",
        })).filter((call) => call.name),
      };
    }
    let text = "";
    let usage = null;
    let finishReason = "";
    const calls = new Map();
    await consumeSse(response, async (raw) => {
      if (raw === "[DONE]") return;
      const data = parseJson(raw);
      if (data?.usage) usage = data.usage;
      const choice = data?.choices?.[0];
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      const delta = choice?.delta?.content;
      if (typeof delta === "string" && delta) {
        text += delta;
        await onText?.(delta, text);
      }
      for (const part of choice?.delta?.tool_calls || []) {
        const index = Number.isInteger(part.index) ? part.index : calls.size;
        const current = calls.get(index) || { id: "", name: "", arguments: "" };
        if (part.id) current.id = part.id;
        if (part.function?.name) current.name += part.function.name;
        if (part.function?.arguments) current.arguments += part.function.arguments;
        calls.set(index, current);
      }
    });
    return {
      text,
      usage,
      finishReason,
      toolCalls: [...calls.entries()].sort(([a], [b]) => a - b).map(([index, call]) => ({
        id: call.id || `tool-call-${index + 1}`,
        name: call.name,
        arguments: call.arguments || "{}",
      })).filter((call) => call.name),
    };
  }

  async test({ signal } = {}) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      signal: signalWithTimeout(signal, 30_000),
      body: JSON.stringify({
        model: this.model,
        stream: false,
        max_tokens: 8,
        messages: [{ role: "user", content: "Reply with exactly: ASUKA-OK" }],
      }),
    });
    if (!response.ok) throw await responseError(response);
    return response.json();
  }

  async listModels({ signal } = {}) {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: { authorization: `Bearer ${this.apiKey}` },
      signal: signalWithTimeout(signal, 30_000),
    });
    if (!response.ok) throw await responseError(response);
    const data = await response.json();
    return (data?.data || []).map((item) => item.id).filter(Boolean);
  }
}

export class AnthropicClient {
  constructor(config) {
    this.kind = "anthropic";
    this.baseUrl = trimBaseUrl(config.baseUrl || "https://api.anthropic.com");
    this.model = config.model;
    this.apiKey = config.apiKey;
  }

  endpoint(path) {
    return this.baseUrl.endsWith("/v1") ? `${this.baseUrl}${path}` : `${this.baseUrl}/v1${path}`;
  }

  headers() {
    return {
      "content-type": "application/json",
      "x-api-key": this.apiKey,
      "anthropic-version": "2023-06-01",
    };
  }

  async generate({ system, messages, tools = [], maxTokens = 4096, signal, onText }) {
    const body = {
      model: this.model,
      max_tokens: maxTokens,
      stream: true,
      system,
      messages: anthropicMessages(messages),
    };
    if (tools.length) {
      body.tools = tools.map((tool) => ({
        name: tool.name,
        description: tool.description || "",
        input_schema: tool.parameters || { type: "object", properties: {} },
      }));
    }
    const response = await fetch(this.endpoint("/messages"), {
      method: "POST",
      headers: this.headers(),
      signal: signalWithTimeout(signal, 10 * 60_000),
      body: JSON.stringify(body),
    });
    if (!response.ok) throw await responseError(response);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) {
      const data = await response.json();
      const blocks = Array.isArray(data?.content) ? data.content : [];
      const text = blocks.filter((item) => item.type === "text").map((item) => item.text).join("");
      if (text) await onText?.(text);
      return {
        text,
        usage: data?.usage || null,
        finishReason: data?.stop_reason || "",
        toolCalls: blocks.filter((item) => item.type === "tool_use").map((item) => ({
          id: item.id,
          name: item.name,
          arguments: JSON.stringify(item.input || {}),
        })),
      };
    }
    let text = "";
    let usage = null;
    let finishReason = "";
    const calls = new Map();
    await consumeSse(response, async (raw) => {
      const data = parseJson(raw);
      if (data?.type === "message_start") usage = data?.message?.usage || usage;
      if (data?.type === "message_delta" && data?.usage) usage = { ...(usage || {}), ...data.usage };
      if (data?.type === "message_delta" && data?.delta?.stop_reason) finishReason = data.delta.stop_reason;
      if (data?.type === "content_block_start" && data?.content_block?.type === "tool_use") {
        calls.set(data.index, { id: data.content_block.id, name: data.content_block.name, arguments: "" });
      }
      if (data?.type === "content_block_delta" && data?.delta?.type === "text_delta") {
        const delta = data.delta.text || "";
        if (delta) {
          text += delta;
          await onText?.(delta, text);
        }
      }
      if (data?.type === "content_block_delta" && data?.delta?.type === "input_json_delta") {
        const current = calls.get(data.index);
        if (current) current.arguments += data.delta.partial_json || "";
      }
    });
    return {
      text,
      usage,
      finishReason,
      toolCalls: [...calls.entries()].sort(([a], [b]) => a - b).map(([, call]) => ({
        id: call.id,
        name: call.name,
        arguments: call.arguments || "{}",
      })).filter((call) => call.name),
    };
  }

  async test({ signal } = {}) {
    const response = await fetch(this.endpoint("/messages"), {
      method: "POST",
      headers: this.headers(),
      signal: signalWithTimeout(signal, 30_000),
      body: JSON.stringify({
        model: this.model,
        max_tokens: 8,
        messages: [{ role: "user", content: "Reply with exactly: ASUKA-OK" }],
      }),
    });
    if (!response.ok) throw await responseError(response);
    return response.json();
  }

  async listModels({ signal } = {}) {
    const response = await fetch(this.endpoint("/models"), {
      headers: this.headers(),
      signal: signalWithTimeout(signal, 30_000),
    });
    if (!response.ok) throw await responseError(response);
    const data = await response.json();
    return (data?.data || []).map((item) => item.id).filter(Boolean);
  }
}

export function createProviderClient(config) {
  if (config.kind === "anthropic") return new AnthropicClient(config);
  if (config.kind === "openai-compatible" || config.kind === "openai") return new OpenAICompatibleClient(config);
  throw new Error(`unsupported native provider: ${config.kind}`);
}
