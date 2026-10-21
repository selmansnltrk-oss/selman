const fs = require("node:fs");
const path = require("node:path");
const origin = process.env.DEFTER_MEMBERSHIP_API_ORIGIN || "";
if (!origin && process.argv.includes("--required")) {
  throw Error("Windows paketi için DEFTER_MEMBERSHIP_API_ORIGIN gerekli. Gerçek Render HTTPS kök adresini .env dosyasına veya derleme ortamına girin.");
}
if (origin) {
  const u = new URL(origin);
  if (
    u.protocol !== "https:" ||
    u.origin !== origin ||
    u.username ||
    u.password
  )
    throw Error(
      "DEFTER_MEMBERSHIP_API_ORIGIN HTTPS origin olmalı (yol/son slash yok).",
    );
}
fs.writeFileSync(
  path.join(__dirname, "../electron/membership-config.json"),
  JSON.stringify({ apiOrigin: origin }),
);
console.log(
  origin
    ? "Public membership origin configured."
    : "Membership API origin missing: desktop will remain locked.",
);
