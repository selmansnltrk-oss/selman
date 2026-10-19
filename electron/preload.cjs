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

contextBridge.exposeInMainWorld("defterMembership", {
  state: () => ipcRenderer.invoke("membership:state"),
  login: () => ipcRenderer.invoke("membership:login"),
  check: () => ipcRenderer.invoke("membership:check"),
  logout: () => ipcRenderer.invoke("membership:logout"),
  website: () => ipcRenderer.invoke("membership:website"),
  subscribe: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on("membership:changed", handler);
    return () => ipcRenderer.removeListener("membership:changed", handler);
  },
});
