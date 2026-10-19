import { DatabaseSync } from "node:sqlite";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("base64url");
export const random = () => randomBytes(32).toString("base64url");
export class Store {
  db: DatabaseSync;
  constructor(
    file: string,
    private key: Buffer,
  ) {
    if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,expires INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(kind,id));",
    );
  }
  encrypt(value: unknown) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const body = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), body]
      .map((b) => b.toString("base64"))
      .join(".");
  }
  decrypt<T>(s: string): T {
    const [iv, tag, body] = s.split(".").map((s) => Buffer.from(s, "base64"));
    const cipher = createDecipheriv("aes-256-gcm", this.key, iv);
    cipher.setAuthTag(tag);
    return JSON.parse(
      Buffer.concat([cipher.update(body), cipher.final()]).toString("utf8"),
    );
  }
  put(kind: string, id: string, value: unknown, expires: number) {
    this.db
      .prepare("INSERT OR REPLACE INTO records VALUES(?,?,?,?)")
      .run(kind, id, expires, this.encrypt(value));
  }
  get<T>(
    kind: string,
    id: string,
    now = Date.now(),
  ): { value: T; expires: number } | null {
    const row = this.db
      .prepare(
        "SELECT payload,expires FROM records WHERE kind=? AND id=? AND expires>?",
      )
      .get(kind, id, now);
    return row
      ? {
          value: this.decrypt<T>(String(row.payload)),
          expires: Number(row.expires),
        }
      : null;
  }
  remove(kind: string, id: string) {
    this.db.prepare("DELETE FROM records WHERE kind=? AND id=?").run(kind, id);
  }
  take<T>(kind: string, id: string): { value: T; expires: number } | null {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const record = this.get<T>(kind, id);
      this.remove(kind, id);
      this.db.exec("COMMIT");
      return record;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  cleanup(now = Date.now()) {
    this.db.prepare("DELETE FROM records WHERE expires<=?").run(now);
  }
  close() {
    this.db.close();
  }
}
