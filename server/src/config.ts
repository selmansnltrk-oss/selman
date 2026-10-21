import { z } from "zod";
import { SITE_ID } from "./policy.js";
const schema = z.object({
  NODE_ENV: z.enum(["production", "development", "test"]).default("production"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  PUBLIC_ORIGIN: z.url(),
  WIX_CLIENT_ID: z.uuid(),
  WIX_SITE_ID: z.literal(SITE_ID),
  SERVER_DATA_KEY: z
    .string()
    .refine(
      (v) =>
        /^[A-Za-z0-9+/]{43}=$/.test(v) &&
        Buffer.from(v, "base64").length === 32,
      "32 bayt base64 sunucu anahtarı gerekli",
    ),
  DATABASE_PATH: z.string().min(1).default("./data/membership.sqlite"),
  ALLOW_LOCAL_HTTP: z.enum(["true", "false"]).default("false"),
});
// Never expose Zod's raw errors: literal validators can include configured values.
export class ConfigurationError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join("; "));
    this.name = "ConfigurationError";
  }
}
const requirements: Record<string, string> = {
  NODE_ENV: "production, development veya test olmalı",
  HOST: "boş olamaz; Render için 0.0.0.0 kullanın",
  PORT: "1–65535 arasında tam sayı olmalı; Render otomatik sağlar",
  PUBLIC_ORIGIN: "geçerli mutlak URL gerekli; boşsa RENDER_EXTERNAL_URL kullanılır",
  WIX_CLIENT_ID: "36 karakter UUID gerekli (Wix Headless Client ID)",
  WIX_SITE_ID: "bu projenin sabit Wix Site ID değeriyle birebir eşleşmeli",
  SERVER_DATA_KEY: "tam 32 bayt standart base64 gerekli: 44 karakter, sonunda =; hex veya rastgele metin kabul edilmez",
  DATABASE_PATH: "en az 1 karakter gerekli; ücretsiz Render için :memory:",
  ALLOW_LOCAL_HTTP: "true veya false olmalı",
};
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = schema.safeParse({
    ...env,
    PUBLIC_ORIGIN: env.PUBLIC_ORIGIN?.trim() || env.RENDER_EXTERNAL_URL?.trim(),
  });
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
    throw new ConfigurationError(fields.map((field) => `${field}: ${requirements[field] ?? "geçersiz yapılandırma"}`));
  }
  const p = parsed.data, origin = new URL(p.PUBLIC_ORIGIN);
  if (origin.origin !== p.PUBLIC_ORIGIN.replace(/\/$/, ""))
    throw new ConfigurationError(["PUBLIC_ORIGIN: yalnızca HTTPS kök adresi olmalı; yol (/auth/callback dahil), sorgu, kullanıcı bilgisi veya fragment eklemeyin"]);
  const local =
    p.NODE_ENV !== "production" &&
    p.ALLOW_LOCAL_HTTP === "true" &&
    ["localhost", "127.0.0.1"].includes(origin.hostname);
  if (origin.protocol !== "https:" && !local)
    throw new ConfigurationError(["PUBLIC_ORIGIN: üretimde HTTPS gerekli; HTTP kabul edilmez"]);
  return {
    ...p,
    PUBLIC_ORIGIN: origin.origin,
    callback: origin.origin + "/auth/callback",
    key: Buffer.from(p.SERVER_DATA_KEY, "base64"),
  };
}
export type Config = ReturnType<typeof loadConfig>;
