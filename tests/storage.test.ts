import { it, expect } from "vitest";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaults, newDay, calculate, rangeDays } from "../src/model";
const require = createRequire(import.meta.url);
const { openStore } = require("../electron/storage.cjs");
it("SQLite: gün ve ayar kaydı, yeniden açma, düzenleme, tarih raporu, yedekleme ve geri yükleme", async () => {
  const dir = mkdtempSync(join(tmpdir(), "defter-test-")),
    file = join(dir, "test.sqlite");
  let store = await openStore(file);
  try {
    const d = newDay(defaults, "2026-10-19");
    d.incomes[0].amount = 100000;
    store.write("settings", defaults);
    store.write("day:" + d.date, d);
    expect(store.list()).toHaveLength(1);
    expect(store.read("day:" + d.date)).toEqual(d);
    store.close();
    store = await openStore(file);
    expect(store.read("settings")).toEqual(defaults);
    expect(calculate(store.list()[0]).result).toBe(100000);
    d.incomes[0].amount = 200000;
    store.write("day:" + d.date, d);
    expect(store.list()).toHaveLength(1);
    expect(calculate(store.list()[0]).result).toBe(200000);
    const other = newDay(defaults, "2026-11-01");
    store.write("day:" + other.date, other);
    expect(rangeDays(store.list(), "2026-10-01", "2026-10-31")).toHaveLength(1);
    const backup = JSON.parse(store.backup());
    store.restore({ settings: null, days: [] });
    expect(store.list()).toHaveLength(0);
    store.restore(backup);
    expect(store.list()).toHaveLength(2);
    expect(store.read("settings")).toEqual(defaults);
    store.close();
    store = await openStore(file);
    expect(calculate(store.read("day:2026-10-19")).result).toBe(200000);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
