const { _electron: electron, expect } = require("@playwright/test");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
(async () => {
  let app;
  const config = mkdtempSync(path.join(tmpdir(), "defter-desktop-"));
  const launch = () =>
    electron.launch({
      executablePath: process.env.DEFTER_EXECUTABLE || require("electron"),
      args: [
        `--defter-data-dir=${path.join(config, "data")}`,
        ...(process.env.DEFTER_EXECUTABLE ? [] : ["."]),
        ...(process.env.CI ? ["--no-sandbox"] : []),
      ],
      env: {
        ...process.env,
        XDG_CONFIG_HOME: config,
        XDG_CACHE_HOME: path.join(config, "cache"),
      },
      timeout: 30000,
    });
  try {
    app = await launch();
    let page = await app.firstWindow();
    await page.waitForSelector("nav");
    await expect(
      page.getByRole("button", { name: "Günü kaydet" }),
    ).toBeEnabled();
    console.log(
      "Electron açıldı; güvenli IPC:",
      await page.evaluate(() => typeof window.defter.listDays),
    );
    await page.getByLabel("Yemeksepeti geliri").fill("1234,56");
    await page.getByLabel("Yemeksepeti geliri").blur();
    await page.getByRole("button", { name: "Günü kaydet" }).click();
    await expect(page.getByText("Günün kaydı güvenle saklandı.")).toBeVisible();
    const rows = await page.evaluate(() => window.defter.listDays());
    if (rows.length !== 1 || rows[0].incomes[0].amount !== 123456)
      throw Error("IPC kaydı doğrulanamadı");
    const conflict = await page.evaluate(async () => {
      const days = await window.defter.listDays();
      return window.defter.saveDay(days[0]);
    });
    if (!conflict.conflict)
      throw Error("Aynı gün için güncelleme onayı istenmedi");
    const invalidRejected = await page.evaluate(async () => {
      const [day] = await window.defter.listDays();
      day.incomes[0].amount = -1;
      try {
        await window.defter.saveDay(day, true);
        return false;
      } catch {
        return true;
      }
    });
    if (!invalidRejected) throw Error("IPC hatalı tutarı reddetmedi");
    await page.evaluate(async () => {
      const [d] = await window.defter.listDays();
      d.tax.enabled = true;
      d.tax.confirmed = true;
      d.tax.method = "corporate";
      d.tax.vatDefault = 2000;
      d.taxPaid = 500;
      await window.defter.saveDay(d, true);
      const [saved] = await window.defter.listDays();
      if (!saved.tax.confirmed || saved.taxPaid !== 500)
        throw Error("Vergi profili IPC ile saklanmadı");
    });
    const backupFile = path.join(config, "desktop-backup.json");
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
      dialog.showMessageBox = async () => ({
        response: 1,
        checkboxChecked: false,
      });
    }, backupFile);
    if (!(await page.evaluate(() => window.defter.backup())))
      throw Error("Yedek oluşturulamadı");
    await page.evaluate(async () => {
      const [d] = await window.defter.listDays();
      await window.defter.deleteDay(d.date);
    });
    if ((await page.evaluate(() => window.defter.listDays())).length !== 0)
      throw Error("Silme işlemi başarısız");
    if (!(await page.evaluate(() => window.defter.restore())))
      throw Error("Geri yükleme başarısız");
    if ((await page.evaluate(() => window.defter.listDays())).length !== 1)
      throw Error("Yedek kaydı geri gelmedi");
    console.log(
      "IPC doğrulama, kayıt çakışması, yedekleme, silme ve geri yükleme doğrulandı",
    );
    const security = await app.evaluate(({ BrowserWindow }) => {
      const p =
        BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
      return {
        contextIsolation: p.contextIsolation,
        nodeIntegration: p.nodeIntegration,
        sandbox: p.sandbox,
      };
    });
    if (
      !security.contextIsolation ||
      security.nodeIntegration ||
      !security.sandbox
    )
      throw Error("Güvenlik ayarları yanlış");
    console.log("SQLite IPC kaydı ve güvenlik ayarları doğrulandı");
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await expect(page.getByLabel("Yemeksepeti geliri")).toHaveValue("1.234,56");
    console.log("Uygulama kapatılıp yeniden açıldı; kayıt korundu.");
    console.log("PASS: desktop smoke");
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    if (app) await app.close();
    rmSync(config, { recursive: true, force: true });
  }
})();
