import { app, BrowserWindow, Menu, dialog, ipcMain, safeStorage, session, shell } from "electron";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startAsukaServer } from "../server.mjs";
import { electronSecretStore } from "../server/native/secret-store.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
process.env.ASUKA_DESKTOP_VERSION = app.getVersion();
const userDataOverride = process.env.ASUKA_USER_DATA_DIR?.trim();
if (userDataOverride) {
  mkdirSync(userDataOverride, { recursive: true });
  app.setPath("userData", userDataOverride);
}
const lock = app.requestSingleInstanceLock();
let mainWindow = null;
let desktopServer = null;
let allowWindowClose = false;
let closeDialogOpen = false;

app.setName("ASUKA");
app.setAppUserModelId("com.asuka.personal");

function windowStatePath() {
  return join(app.getPath("userData"), "window-state.json");
}

function loadWindowState() {
  try {
    const saved = JSON.parse(readFileSync(windowStatePath(), "utf8"));
    if (Number.isFinite(saved.width) && Number.isFinite(saved.height)) return saved;
  } catch {
    // First launch or an invalid state file uses the defaults below.
  }
  return { width: 1440, height: 900, maximized: false };
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const bounds = mainWindow.getNormalBounds();
    mkdirSync(app.getPath("userData"), { recursive: true });
    writeFileSync(windowStatePath(), JSON.stringify({ ...bounds, maximized: mainWindow.isMaximized() }), "utf8");
  } catch {
    // Window diagnostics must never block shutdown.
  }
}

async function createWindow() {
  const devUrl = process.env.ASUKA_DEV_URL?.trim();
  const smokeTest = process.env.ASUKA_SMOKE === "1";
  const startHidden = smokeTest || process.env.ASUKA_HIDDEN === "1";
  const savedWindow = loadWindowState();
  allowWindowClose = false;
  closeDialogOpen = false;
  if (!devUrl && !desktopServer) {
    const defaultWorkspace = process.env.ASUKA_WORKSPACE || join(app.getPath("documents"), "ASUKA");
    mkdirSync(defaultWorkspace, { recursive: true });
    desktopServer = await startAsukaServer({
      port: Number(process.env.ASUKA_PORT || 0),
      host: "127.0.0.1",
      dataDir: process.env.ASUKA_DATA_DIR || app.getPath("userData"),
      workspaceDir: defaultWorkspace,
      secretStore: electronSecretStore(safeStorage),
    });
  }

  const appUrl = devUrl || desktopServer.origin;
  const appOrigin = new URL(appUrl).origin;
  mainWindow = new BrowserWindow({
    width: savedWindow.width,
    height: savedWindow.height,
    minWidth: 980,
    minHeight: 680,
    show: false,
    title: "ASUKA",
    backgroundColor: "#191817",
    autoHideMenuBar: true,
    icon: join(currentDir, "../build/icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      preload: join(currentDir, "preload.js"),
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin === appOrigin) return;
    event.preventDefault();
    if (/^https?:/i.test(url)) void shell.openExternal(url);
  });
  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error(`ASUKA_PRELOAD_ERROR ${preloadPath} ${error?.stack || error}`);
  });
  mainWindow.once("ready-to-show", () => {
    if (startHidden) return;
    if (savedWindow.maximized) mainWindow?.maximize();
    mainWindow?.show();
  });
  mainWindow.on("close", async (event) => {
    saveWindowState();
    if (allowWindowClose || smokeTest) return;
    let closeConfirm = true;
    try {
      closeConfirm = desktopServer?.settingsStore?.get()?.general?.closeConfirm !== false;
    } catch {
      // An unreadable settings file should not make the window impossible to close.
    }
    if (!closeConfirm) {
      allowWindowClose = true;
      return;
    }
    event.preventDefault();
    if (closeDialogOpen) return;
    closeDialogOpen = true;
    const result = await dialog.showMessageBox(mainWindow, {
      type: "question",
      title: "关闭 ASUKA",
      message: "要关闭 ASUKA 吗？",
      detail: "仍在上传或修改中的任务会被中断。已保存的任务与设置会保留。",
      buttons: ["关闭 ASUKA", "取消"],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    });
    closeDialogOpen = false;
    if (result.response !== 0 || !mainWindow || mainWindow.isDestroyed()) return;
    allowWindowClose = true;
    mainWindow.close();
  });
  mainWindow.on("closed", () => { mainWindow = null; });
  mainWindow.webContents.once("did-finish-load", () => {
    console.log(`ASUKA_DESKTOP_READY ${appUrl}`);
    if (smokeTest) setTimeout(() => app.exit(0), 250);
  });

  await mainWindow.loadURL(appUrl);
  if (process.env.ASUKA_OPEN_DEVTOOLS === "1") mainWindow.webContents.openDevTools({ mode: "detach" });
}

if (!lock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    ipcMain.handle("asuka:pick-directory", async () => {
      const options = {
        title: "选择 ASUKA 默认工作目录",
        properties: ["openDirectory", "createDirectory"],
      };
      const owner = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
      const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
      return result.canceled ? "" : result.filePaths[0] || "";
    });
    ipcMain.handle("asuka:open-path", async (_event, filePath) => {
      const target = String(filePath || "").trim();
      if (!target || !existsSync(target) || !statSync(target).isFile()) return { ok: false, error: "Artifact file does not exist" };
      const error = await shell.openPath(target);
      return { ok: !error, error };
    });
    ipcMain.handle("asuka:reveal-path", (_event, filePath) => {
      const target = String(filePath || "").trim();
      if (!target || !existsSync(target)) return { ok: false, error: "Artifact file does not exist" };
      shell.showItemInFolder(target);
      return { ok: true };
    });
    await createWindow();
  }).catch((error) => {
    dialog.showErrorBox("ASUKA failed to start", error instanceof Error ? error.message : String(error));
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
  app.on("before-quit", () => { allowWindowClose = true; });
  app.on("window-all-closed", () => app.quit());
  app.on("will-quit", () => {
    desktopServer?.server.close();
  });
}
