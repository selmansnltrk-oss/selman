const initSqlJs = require("sql.js");
const fs = require("node:fs");
const path = require("node:path");
async function openStore(filename) {
  const SQL = await initSqlJs({
    locateFile: (f) => require.resolve("sql.js/dist/" + f),
  });
  let db = fs.existsSync(filename)
    ? new SQL.Database(fs.readFileSync(filename))
    : new SQL.Database();
  db.run(
    "CREATE TABLE IF NOT EXISTS documents (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  );
  const read = (key) => {
    const s = db.prepare("SELECT value FROM documents WHERE key=?");
    try {
      s.bind([key]);
      return s.step() ? JSON.parse(s.getAsObject().value) : null;
    } finally {
      s.free();
    }
  };
  const persist = () => {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    const tmp = filename + ".tmp";
    fs.writeFileSync(tmp, db.export());
    fs.renameSync(tmp, filename);
  };
  const mutate = (fn) => {
    const previous = db.export();
    db.run("BEGIN");
    try {
      fn();
      db.run("COMMIT");
      persist();
    } catch (e) {
      db.close();
      db = new SQL.Database(previous);
      throw e;
    }
  };
  const write = (key, value) =>
    mutate(() =>
      db.run("INSERT OR REPLACE INTO documents(key,value) VALUES (?,?)", [
        key,
        JSON.stringify(value),
      ]),
    );
  const list = () => {
    const r = db.exec(
      "SELECT value FROM documents WHERE key LIKE 'day:%' ORDER BY key DESC",
    );
    return r.length ? r[0].values.map((v) => JSON.parse(v[0])) : [];
  };
  const backup = () =>
    JSON.stringify({
      format: "defter-mini",
      version: 1,
      settings: read("settings"),
      days: list(),
    });
  const restore = (data) =>
    mutate(() => {
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
    });
  return { read, write, list, backup, restore, close: () => db.close() };
}
module.exports = { openStore };
