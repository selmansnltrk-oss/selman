const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { openStore } = require("./storage.cjs");
let store, win;
app.whenReady().then(async () => {
  store = await openStore(
    path.join(app.getPath("userData"), "defter-mini.sqlite"),
  );
  const { z } = require("zod");
  const {
    settingsSchema: settings,
    daySchema,
    dateSchema: date,
    calculate,
  } = require("./model.cjs");
  const day = daySchema.refine(
    (d) =>
      d.pos.reduce((a, p) => a + p.amount, 0) <=
      d.incomes.reduce((a, i) => a + i.amount, 0),
  );
  const backup = z
    .object({
      format: z.literal("defter-mini"),
      version: z.literal(1),
      settings: settings.nullable(),
      days: z.array(day).max(50000),
    })
    .refine((b) => new Set(b.days.map((d) => d.date)).size === b.days.length);
  function handle(name, fn) {
    ipcMain.handle(name, async (event, ...args) => {
      if (
        event.sender !== win.webContents ||
        event.senderFrame !== win.webContents.mainFrame
      )
        throw Error("İzin verilmeyen istek");
      return fn(...args);
    });
  }
  handle("settings:get", () => store.read("settings"));
  handle("settings:save", (s) => store.write("settings", settings.parse(s)));
  handle("days:list", () => store.list());
  handle("day:save", (d, overwrite) => {
    const valid = day.parse(d);
    if (store.read("day:" + valid.date) && overwrite !== true)
      return { conflict: true };
    store.write("day:" + valid.date, {
      ...valid,
      calculated: calculate(valid),
      calculationVersion: 1,
    });
    return { conflict: false };
  });
  handle("day:delete", async (d) => {
    date.parse(d);
    const r = await dialog.showMessageBox(win, {
      type: "warning",
      buttons: ["Vazgeç", "Sil"],
      defaultId: 0,
      cancelId: 0,
      message: "Bu günün kaydı kalıcı olarak silinsin mi?",
    });
    if (r.response !== 1) return false;
    const b = JSON.parse(store.backup());
    b.days = b.days.filter((x) => x.date !== d);
    store.restore(b);
    return true;
  });
  handle("backup", async () => {
    const r = await dialog.showSaveDialog(win, {
      defaultPath: "defter-mini-yedek.json",
      filters: [{ name: "Defter Mini yedeği", extensions: ["json"] }],
    });
    if (r.canceled) return false;
    fs.writeFileSync(r.filePath, store.backup(), "utf8");
    return true;
  });
  handle("restore", async () => {
    const r = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "Defter Mini yedeği", extensions: ["json"] }],
    });
    if (r.canceled) return false;
    const file = r.filePaths[0];
    if (fs.statSync(file).size > 50 * 1024 * 1024)
      throw Error("Yedek çok büyük");
    const data = backup.parse(JSON.parse(fs.readFileSync(file, "utf8")));
    const c = await dialog.showMessageBox(win, {
      type: "warning",
      buttons: ["Vazgeç", "Geri yükle"],
      defaultId: 0,
      cancelId: 0,
      message:
        "Mevcut veriler yedekteki verilerle değiştirilecek. Devam edilsin mi?",
    });
    if (c.response !== 1) return false;
    fs.writeFileSync(
      path.join(app.getPath("userData"), "geri-yukleme-oncesi.json"),
      store.backup(),
    );
    store.restore(data);
    return true;
  });
  win = new BrowserWindow({
    width: 1440,
    height: 950,
    minWidth: 1000,
    minHeight: 720,
    backgroundColor: "#f5f7f9",
    title: "Defter Mini",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    const allowed = process.env.VITE_DEV_SERVER_URL;
    if (!allowed || new URL(url).origin !== new URL(allowed).origin)
      event.preventDefault();
  });
  win.webContents.session.webRequest.onHeadersReceived((details, callback) =>
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws://localhost:5173; worker-src 'self' blob:; object-src 'none'; base-uri 'self'",
        ],
      },
    }),
  );
  if (process.env.VITE_DEV_SERVER_URL)
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else await win.loadFile(path.join(__dirname, "../dist/index.html"));
});
app.on("window-all-closed", () => app.quit());
