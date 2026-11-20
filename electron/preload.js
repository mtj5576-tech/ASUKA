const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("asukaDesktop", {
  pickDirectory: () => ipcRenderer.invoke("asuka:pick-directory"),
  openPath: (path) => ipcRenderer.invoke("asuka:open-path", path),
  revealPath: (path) => ipcRenderer.invoke("asuka:reveal-path", path),
});
