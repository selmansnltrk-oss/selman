import initSqlJs, { type Database } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import {
  calculate,
  settingsSchema,
  daySchema,
  type Settings,
  type Day,
} from "./model";
import { z } from "zod";
export interface API {
  getSettings(): Promise<Settings | null>;
  saveSettings(s: Settings): Promise<void>;
  listDays(): Promise<Day[]>;
  saveDay(d: Day, overwrite?: boolean): Promise<{ conflict: boolean }>;
  deleteDay(date: string): Promise<boolean>;
  backup(): Promise<boolean>;
  restore(): Promise<boolean>;
}
declare global {
  interface Window {
    defter?: API;
  }
}
const backupSchema = z
  .object({
    format: z.literal("defter-mini"),
    version: z.literal(1),
    settings: settingsSchema.nullable(),
    days: z.array(daySchema).max(50000),
  })
  .refine((b) => new Set(b.days.map((d) => d.date)).size === b.days.length);
export async function connect(): Promise<API> {
  if (window.defter) return window.defter;
  // Browser demo also uses SQLite; desktop storage is exclusively in the main process.
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const existing = localStorage.getItem("defter-mini-sqlite-v1");
  const db: Database = existing
    ? new SQL.Database(Uint8Array.from(atob(existing), (c) => c.charCodeAt(0)))
    : new SQL.Database();
  db.run(
    "CREATE TABLE IF NOT EXISTS documents(key TEXT PRIMARY KEY,value TEXT NOT NULL)",
  );
  function persist() {
    const bytes = db.export();
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    localStorage.setItem("defter-mini-sqlite-v1", btoa(s));
  }
  function read(key: string) {
    const q = db.prepare("SELECT value FROM documents WHERE key=?");
    try {
      q.bind([key]);
      return q.step() ? JSON.parse(q.getAsObject().value as string) : null;
    } finally {
      q.free();
    }
  }
  function write(key: string, value: unknown) {
    const previous = read(key);
    db.run("INSERT OR REPLACE INTO documents VALUES (?,?)", [
      key,
      JSON.stringify(value),
    ]);
    try {
      persist();
    } catch (e) {
      if (previous === null) db.run("DELETE FROM documents WHERE key=?", [key]);
      else
        db.run("INSERT OR REPLACE INTO documents VALUES (?,?)", [
          key,
          JSON.stringify(previous),
        ]);
      throw e;
    }
  }
  function list(): Day[] {
    const r = db.exec(
      "SELECT value FROM documents WHERE key LIKE 'day:%' ORDER BY key DESC",
    );
    return r.length
      ? r[0].values.map((v) => daySchema.parse(JSON.parse(v[0] as string)))
      : [];
  }
  return {
    getSettings: async () => read("settings"),
    saveSettings: async (s) => write("settings", settingsSchema.parse(s)),
    listDays: async () => list(),
    saveDay: async (d, overwrite) => {
      daySchema.parse(d);
      if (read("day:" + d.date) && !overwrite) return { conflict: true };
      write("day:" + d.date, {
        ...d,
        calculated: calculate(d),
        calculationVersion: 1,
      });
      return { conflict: false };
    },
    deleteDay: async (date) => {
      if (!confirm("Bu günün kaydı kalıcı olarak silinsin mi?")) return false;
      const old = read("day:" + date);
      db.run("DELETE FROM documents WHERE key=?", ["day:" + date]);
      try {
        persist();
      } catch (e) {
        write("day:" + date, old);
        throw e;
      }
      return true;
    },
    backup: async () => {
      const data = {
        format: "defter-mini",
        version: 1,
        settings: read("settings"),
        days: list(),
      };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "defter-mini-yedek.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    },
    restore: () =>
      new Promise((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.oncancel = () => resolve(false);
        input.onchange = async () => {
          try {
            const f = input.files?.[0];
            if (!f) {
              resolve(false);
              return;
            }
            if (f.size > 50 * 1024 * 1024) throw Error("Yedek çok büyük");
            const data = backupSchema.parse(JSON.parse(await f.text()));
            data.days.forEach((d) => calculate(d));
            if (
              !confirm(
                "Mevcut veriler değiştirilecek. Önce yedek aldığınızdan emin olun. Devam edilsin mi?",
              )
            ) {
              resolve(false);
              return;
            }
            const old = db.export();
            db.run("BEGIN");
            try {
              db.run("DELETE FROM documents");
              if (data.settings)
                db.run("INSERT INTO documents VALUES (?,?)", [
                  "settings",
                  JSON.stringify(data.settings),
                ]);
              for (const d of data.days)
                db.run("INSERT INTO documents VALUES (?,?)", [
                  "day:" + d.date,
                  JSON.stringify(d),
                ]);
              db.run("COMMIT");
              persist();
            } catch (e) {
              try {
                db.run("ROLLBACK");
              } catch {}
              const restored = new SQL.Database(old);
              db.run("DELETE FROM documents");
              const rows = restored.exec("SELECT key,value FROM documents");
              for (const row of rows[0]?.values ?? [])
                db.run("INSERT INTO documents VALUES (?,?)", row);
              restored.close();
              throw e;
            }
            resolve(true);
          } catch (e) {
            reject(e);
          }
        };
        input.click();
      }),
  };
}
