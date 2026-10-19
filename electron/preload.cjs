const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("defter", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (s) => ipcRenderer.invoke("settings:save", s),
  listDays: () => ipcRenderer.invoke("days:list"),
  saveDay: (d, overwrite) => ipcRenderer.invoke("day:save", d, overwrite),
  deleteDay: (date) => ipcRenderer.invoke("day:delete", date),
  backup: () => ipcRenderer.invoke("backup"),
  restore: () => ipcRenderer.invoke("restore"),
});
