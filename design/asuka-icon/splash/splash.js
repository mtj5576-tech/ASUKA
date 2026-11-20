const BOTS = {
  nova:  { name: "NOVA",   role: "CORE",       index: "01 / CORE",       accent: "#35ddd0", place: "Ask NOVA to build something..." },
  byte:  { name: "BYTE",   role: "CODE",       index: "02 / CODE",       accent: "#6bf3ff", place: "Ask BYTE to write the next module..." },
  lens:  { name: "LENS",   role: "RESEARCH",   index: "03 / RESEARCH",   accent: "#d9ff4d", place: "Ask LENS to investigate a signal..." },
  grid:  { name: "GRID",   role: "DATA",       index: "04 / DATA",       accent: "#6be6ff", place: "Ask GRID to map the dataset..." },
  bloom: { name: "BLOOM",  role: "DESIGN",     index: "05 / DESIGN",     accent: "#ffe45c", place: "Ask BLOOM to shape the interface..." },
  relay: { name: "RELAY",  role: "OPS",        index: "06 / OPS",        accent: "#ff9e3d", place: "Ask RELAY to run the operation..." },
  guard: { name: "GUARD",  role: "SECURITY",   index: "07 / SECURITY",   accent: "#ffb03a", place: "Ask GUARD to audit the surface..." },
  sprout:{ name: "SPROUT", role: "GROWTH",     index: "08 / GROWTH",     accent: "#f7ff8a", place: "Ask SPROUT to test the next idea..." },
  luna:  { name: "LUNA",   role: "NIGHT",      index: "09 / NIGHT",      accent: "#ff6bcb", place: "Ask LUNA to prepare the night run..." }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const splash = $("#splash");
const bootLabel = $("#bootLabel");
const bootText = $("#bootText");
const bootPercent = $("#bootPercent");
const bootMeter = $("#bootMeter");
const skipButton = $("#skipButton");
const enterButton = $("#enterButton");
const crewLabel = $("#crewLabel");
const mascot = $(".mascot");
const mascotImage = mascot.querySelector("img");
const agentTag = $(".agent-tag");
const consolePanel = $("#console");
const commandForm = $("#commandForm");
const commandInput = $("#commandInput");
const terminal = $("#terminal");
const terminalHint = $("#terminalHint");
const deckMascot = $("#deckMascot");
const deckIndex = $("#deckIndex");
const deckAgentLabel = $("#deckAgentLabel");
const backButton = $("#backButton");

const stage = { phase: "booting", progress: 0, selected: "nova", raf: 0, start: 0 };
let flowTimers = [];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const stages = [
  [0, "INITIALIZING NOVA CORE"],
  [28, "SYNCING 9 AGENT CREW"],
  [54, "MOUNTING WORKSPACE"],
  [78, "CALIBRATING INTERFACE"],
  [100, "SYSTEM ONLINE"]
];

function setProgress(value) {
  const next = Math.max(0, Math.min(100, value));
  stage.progress = next;
  bootPercent.textContent = `${Math.round(next)}%`;
  bootMeter.style.setProperty("--progress", `${next}%`);
  bootMeter.setAttribute("aria-valuenow", String(Math.round(next)));
  const label = [...stages].reverse().find(([threshold]) => next >= threshold)[1];
  bootText.textContent = `> ${label}`;
}

function finishBoot() {
  if (stage.phase !== "booting") return;
  cancelAnimationFrame(stage.raf);
  stage.phase = "ready";
  setProgress(100);
  splash.classList.add("is-ready");
  document.body.dataset.state = "ready";
  bootText.textContent = "> SYSTEM ONLINE";
  skipButton.hidden = true;
  enterButton.hidden = false;
}

function bootFrame(now) {
  if (stage.phase !== "booting") return;
  if (!stage.start) stage.start = now;
  const duration = reduceMotion.matches ? 900 : 3600;
  const linear = Math.min(1, (now - stage.start) / duration);
  const eased = 1 - Math.pow(1 - linear, 2.2);
  setProgress(eased * 100);
  if (linear >= 1) {
    finishBoot();
    return;
  }
  stage.raf = requestAnimationFrame(bootFrame);
}

function selectBot(key, announce = true) {
  const bot = BOTS[key];
  if (!bot) return;
  clearWorkflow(false);
  stage.selected = key;
  document.documentElement.style.setProperty("--live-accent", bot.accent);
  mascotImage.src = `../bots/asuka-bot-${key}-1024.png`;
  mascotImage.alt = `ASUKA ${bot.name} ${bot.role.toLowerCase()} avatar`;
  deckMascot.src = `../bots/asuka-bot-${key}-512.png`;
  deckMascot.alt = `ASUKA ${bot.name} ${bot.role.toLowerCase()} avatar`;
  agentTag.textContent = `${bot.name} / ${bot.role}`;
  crewLabel.textContent = `${bot.name} / ${bot.role}`;
  deckIndex.textContent = bot.index;
  deckAgentLabel.textContent = `${bot.name} ${bot.role} IS MOUNTED`;
  commandInput.placeholder = bot.place;
  $$(".crew-btn, .bot-choice").forEach((button) => {
    const active = button.dataset.bot === key;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (announce) {
    terminalHint.textContent = `${bot.name} ${bot.role} selected. Awaiting command.`;
  }
}

function scheduleFlow(callback, delay) {
  flowTimers.push(window.setTimeout(callback, delay));
}

function clearWorkflow(updateCopy = true) {
  flowTimers.forEach((timer) => window.clearTimeout(timer));
  flowTimers = [];
  consolePanel.classList.remove("is-thinking", "is-routing", "is-complete");
  $$(".bot-choice").forEach((card) => {
    card.classList.remove("is-thinking", "is-working", "is-done", "is-queued");
    const state = card.querySelector(".bot-state");
    if (state) state.textContent = "READY";
  });
  if (updateCopy) {
    terminalHint.textContent = "Awaiting command.";
  }
}

function setBotWorkState(key, stateName, label) {
  const card = $(`.bot-choice[data-bot="${key}"]`);
  if (!card) return;
  card.classList.remove("is-thinking", "is-working", "is-done", "is-queued");
  if (stateName) card.classList.add(`is-${stateName}`);
  const state = card.querySelector(".bot-state");
  if (state) state.textContent = label;
}

function runExecutionWave(keys, labels) {
  keys.forEach((key, index) => {
    const label = labels[index] || "WORK";
    setBotWorkState(key, "working", label);
    scheduleFlow(() => setBotWorkState(key, "done", "DONE"), 780 + index * 120);
  });
}

function startWorkflow(command) {
  clearWorkflow(false);
  const decisionBot = BOTS[stage.selected];
  const executionKeys = Object.keys(BOTS).filter((key) => key !== stage.selected);
  const taskLabels = {
    byte: "BUILD",
    lens: "SCAN",
    grid: "CHECK",
    bloom: "STYLE",
    relay: "RUN",
    guard: "AUDIT",
    sprout: "TEST",
    luna: "WATCH"
  };

  consolePanel.classList.add("is-thinking");
  deckAgentLabel.textContent = `${decisionBot.name} ${decisionBot.role} IS THINKING`;
  setBotWorkState(stage.selected, "thinking", "THINK");
  executionKeys.forEach((key) => setBotWorkState(key, "queued", "QUEUE"));
  addTerminalLine(`[${decisionBot.name}] INTENT RECEIVED`);
  terminalHint.textContent = `${decisionBot.name} is parsing intent and assigning execution nodes.`;

  scheduleFlow(() => {
    deckAgentLabel.textContent = `${decisionBot.name} IS ROUTING THE CREW`;
    addTerminalLine(`[${decisionBot.name}] ROUTE LOCKED / 8 NODES`);
  }, 1000);

  scheduleFlow(() => {
    consolePanel.classList.remove("is-thinking");
    consolePanel.classList.add("is-routing");
    deckAgentLabel.textContent = "EXECUTION PHASE ACTIVE";
    setBotWorkState(stage.selected, "working", "LEAD");
    runExecutionWave(executionKeys.slice(0, 2), executionKeys.slice(0, 2).map((key) => taskLabels[key]));
    addTerminalLine(`[${executionKeys.slice(0, 2).map((key) => BOTS[key].name).join(" + ")}] EXECUTION STARTED`);
  }, 1800);

  scheduleFlow(() => {
    runExecutionWave(executionKeys.slice(2, 4), executionKeys.slice(2, 4).map((key) => taskLabels[key]));
  }, 2450);

  scheduleFlow(() => {
    runExecutionWave(executionKeys.slice(4), executionKeys.slice(4).map((key) => taskLabels[key]));
  }, 3100);

  scheduleFlow(() => {
    consolePanel.classList.remove("is-routing");
    consolePanel.classList.add("is-complete");
    deckAgentLabel.textContent = "MISSION COMPLETE / 9 OF 9 BOTS";
    setBotWorkState(stage.selected, "done", "DONE");
    executionKeys.forEach((key) => setBotWorkState(key, "done", "DONE"));
    addTerminalLine("MISSION COMPLETE / 9 OF 9 BOTS REPORTED");
    terminalHint.textContent = `Execution complete. ${decisionBot.name} has the result.`;
  }, 4550);
}

function launchConsole() {
  if (stage.phase !== "ready") return;
  stage.phase = "launched";
  splash.classList.add("is-launched");
  consolePanel.setAttribute("aria-hidden", "false");
  document.body.dataset.state = "launched";
  window.setTimeout(() => commandInput.focus(), reduceMotion.matches ? 0 : 650);
}

function returnToBoot() {
  if (stage.phase !== "launched") return;
  clearWorkflow();
  stage.phase = "ready";
  splash.classList.remove("is-launched");
  consolePanel.setAttribute("aria-hidden", "true");
  document.body.dataset.state = "ready";
  window.setTimeout(() => enterButton.focus(), reduceMotion.matches ? 0 : 520);
}

function addTerminalLine(command) {
  const line = document.createElement("p");
  const mark = document.createElement("span");
  mark.textContent = "> ";
  line.append(mark, document.createTextNode(command));
  terminal.insertBefore(line, terminalHint);
  const lines = [...terminal.querySelectorAll("p")];
  if (lines.length > 7) lines[1].remove();
  terminal.scrollTop = terminal.scrollHeight;
}

skipButton.addEventListener("click", finishBoot);
enterButton.addEventListener("click", launchConsole);
backButton.addEventListener("click", returnToBoot);

$$(".crew-btn, .bot-choice").forEach((button) => {
  button.addEventListener("click", () => selectBot(button.dataset.bot));
});

commandForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const command = commandInput.value.trim();
  if (!command) {
    commandInput.focus();
    return;
  }
  const bot = BOTS[stage.selected];
  addTerminalLine(`${bot.name} > ${command.slice(0, 120)}`);
  startWorkflow(command);
  commandInput.value = "";
  commandInput.focus();
});

splash.addEventListener("pointermove", (event) => {
  if (stage.phase === "launched" || event.pointerType === "touch" || reduceMotion.matches) return;
  const rect = splash.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width - .5) * 2;
  const y = ((event.clientY - rect.top) / rect.height - .5) * 2;
  mascotImage.style.setProperty("--parallax-x", `${x * 12}px`);
  mascotImage.style.setProperty("--parallax-y", `${y * 9}px`);
});
splash.addEventListener("pointerleave", () => {
  mascotImage.style.setProperty("--parallax-x", "0px");
  mascotImage.style.setProperty("--parallax-y", "0px");
});

document.addEventListener("keydown", (event) => {
  const tag = document.activeElement?.tagName;
  if (event.key === "Escape" && stage.phase === "launched") {
    event.preventDefault();
    returnToBoot();
  } else if (event.key === "Enter" && stage.phase === "booting" && tag !== "BUTTON") {
    event.preventDefault();
    finishBoot();
  } else if (event.key === "Enter" && stage.phase === "ready" && tag !== "BUTTON" && tag !== "INPUT") {
    event.preventDefault();
    launchConsole();
  }
});

document.body.dataset.state = "booting";
selectBot("nova", false);
setProgress(0);
stage.raf = requestAnimationFrame(bootFrame);
