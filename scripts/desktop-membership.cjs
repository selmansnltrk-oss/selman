const { _electron: electron, expect } = require("@playwright/test");
const { mkdtempSync, rmSync, readFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { openStore } = require("../electron/storage.cjs");
const { defaults, newDay } = require("../electron/model.cjs");
(async () => {
  let app;
  const dir = mkdtempSync(path.join(tmpdir(), "defter-membership-")),
    file = path.join(dir, "defter-mini.sqlite");
  try {
    const store = await openStore(file);
    const day = newDay(defaults);
    day.incomes[0].amount = 123456;
    store.write("day:" + day.date, day);
    store.close();
    const before = readFileSync(file);
    app = await electron.launch({
      executablePath: process.env.DEFTER_EXECUTABLE || require("electron"),
      args: [
        `--defter-data-dir=${dir}`,
        ...(process.env.DEFTER_EXECUTABLE ? [] : ["."]),
        ...(process.env.CI ? ["--no-sandbox"] : []),
      ],
      env: {
        ...process.env,
        XDG_CONFIG_HOME: dir,
        XDG_CACHE_HOME: path.join(dir, "cache"),
      },
    });
    const page = await app.firstWindow();
    await expect(page.locator(".membership-login")).toBeVisible();
    await expect(page.locator("nav")).toHaveCount(0);
    for (const operation of ["getSettings", "listDays", "backup", "restore"]) {
      const denied = await page.evaluate(async (name) => {
        try {
          await window.defter[name]();
          return false;
        } catch {
          return true;
        }
      }, operation);
      if (!denied) throw Error("Protected IPC was reachable: " + operation);
    }
    const dataDenied = await page.evaluate(async () => {
      try {
        await window.defter.saveSettings({ name: "attacker" });
        return false;
      } catch {
        return true;
      }
    });
    if (!dataDenied) throw Error("Unauthenticated write accepted");
    const state = await page.evaluate(() => window.defterMembership.state());
    if (state.access) throw Error("Unverified access granted");
    await app.close();
    app = null;
    if (!before.equals(readFileSync(file)))
      throw Error("Existing SQLite data changed");
    console.log(
      "PASS: login gate, protected IPC, denied writes, unchanged existing SQLite. No live Wix connection tested.",
    );
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    if (app) await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
})();
