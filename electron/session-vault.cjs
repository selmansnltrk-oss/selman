const fs = require("node:fs");
module.exports.createVault = (safeStorage, file) => {
  const available = () =>
    safeStorage.isEncryptionAvailable() &&
    (!safeStorage.getSelectedStorageBackend ||
      safeStorage.getSelectedStorageBackend() !== "basic_text");
  return {
    read() {
      if (!fs.existsSync(file)) return null;
      if (!available()) throw Error("SECURE_STORAGE_UNAVAILABLE");
      const value = safeStorage.decryptString(fs.readFileSync(file));
      if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw Error("INVALID_SESSION");
      return value;
    },
    write(value) {
      if (!available()) throw Error("SECURE_STORAGE_UNAVAILABLE");
      const tmp = file + ".tmp";
      fs.writeFileSync(tmp, safeStorage.encryptString(value), { mode: 0o600 });
      fs.renameSync(tmp, file);
    },
    clear() {
      fs.rmSync(file, { force: true });
      fs.rmSync(file + ".tmp", { force: true });
    },
  };
};
