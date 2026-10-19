import { z } from "zod";
import { SITE_ID } from "./policy.js";
const schema = z.object({
  NODE_ENV: z.enum(["production", "development", "test"]).default("production"),
  HOST: z.string().default("0.0.0.0"),
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
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const p = schema.parse({
    ...env,
    PUBLIC_ORIGIN: env.PUBLIC_ORIGIN?.trim() || env.RENDER_EXTERNAL_URL?.trim(),
  }),
    origin = new URL(p.PUBLIC_ORIGIN);
  if (origin.origin !== p.PUBLIC_ORIGIN.replace(/\/$/, ""))
    throw Error("PUBLIC_ORIGIN yalnızca kök origin olmalı");
  const local =
    p.NODE_ENV !== "production" &&
    p.ALLOW_LOCAL_HTTP === "true" &&
    ["localhost", "127.0.0.1"].includes(origin.hostname);
  if (origin.protocol !== "https:" && !local)
    throw Error("Üretim backend HTTPS gerektirir");
  return {
    ...p,
    PUBLIC_ORIGIN: origin.origin,
    callback: origin.origin + "/auth/callback",
    key: Buffer.from(p.SERVER_DATA_KEY, "base64"),
  };
}
export type Config = ReturnType<typeof loadConfig>;
