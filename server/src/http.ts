import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { MembershipService, HttpError } from "./service.js";
function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    throw new HttpError(415, "JSON_REQUIRED");
  let text = "";
  for await (const chunk of req) {
    text += chunk.toString();
    if (Buffer.byteLength(text) > 8192)
      throw new HttpError(413, "BODY_TOO_LARGE");
  }
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error();
    return value;
  } catch {
    throw new HttpError(400, "INVALID_JSON");
  }
}
const token = (req: IncomingMessage) => {
  const value = req.headers.authorization;
  if (!value || !/^Bearer [A-Za-z0-9_-]{43}$/.test(value))
    throw new HttpError(401, "SESSION_REQUIRED");
  return value.slice(7);
};
export function createMembershipServer(
  service: MembershipService,
  origin: string,
) {
  const limits = new Map<string, { count: number; until: number }>();
  return createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
    res.setHeader("X-Frame-Options", "DENY");
    if (origin.startsWith("https:"))
      res.setHeader("Strict-Transport-Security", "max-age=31536000");
    try {
      const url = new URL(req.url ?? "/", origin);
      if (req.headers.origin && req.headers.origin !== origin)
        throw new HttpError(403, "ORIGIN_DENIED");
      const now = Date.now();
      for (const [key, l] of limits) if (l.until < now) limits.delete(key);
      const key = req.socket.remoteAddress ?? "unknown";
      const limit = limits.get(key) ?? { count: 0, until: now + 60_000 };
      if (++limit.count > 120) throw new HttpError(429, "RATE_LIMITED");
      limits.set(key, limit);
      if (limits.size > 10000) throw new HttpError(503, "BUSY");
      service.store.cleanup();
      if (req.method === "GET" && url.pathname === "/healthz") {
        json(res, 200, { status: "ok", wixConnectionChecked: false });
        return;
      }
      if (req.method === "POST" && url.pathname === "/v1/auth/attempts") {
        const b = await body(req);
        if (typeof b.challenge !== "string")
          throw new HttpError(400, "INVALID_CHALLENGE");
        json(res, 201, service.createAttempt(b.challenge));
        return;
      }
      const start = url.pathname.match(/^\/auth\/start\/([A-Za-z0-9_-]{43})$/);
      if (req.method === "GET" && start) {
        const location = await service.begin(start[1]);
        res.writeHead(302, { Location: location });
        res.end();
        return;
      }
      if (req.method === "GET" && url.pathname === "/auth/callback") {
        const code = url.searchParams.get("code"),
          state = url.searchParams.get("state");
        if (
          url.searchParams.has("error") ||
          !code ||
          !state ||
          code.length > 4096 ||
          state.length > 256
        )
          throw new HttpError(400, "WIX_LOGIN_CANCELLED");
        await service.callback(code, state);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          '<!doctype html><html lang="tr"><meta charset="utf-8"><title>Defter Mini</title><h1>Giriş tamamlandı.</h1><p>Defter Mini uygulamasına geri dönebilirsiniz. Bu pencereyi kapatabilirsiniz.</p></html>',
        );
        return;
      }
      const exchange = url.pathname.match(
        /^\/v1\/auth\/attempts\/([A-Za-z0-9_-]{43})\/exchange$/,
      );
      if (req.method === "POST" && exchange) {
        const b = await body(req);
        if (typeof b.verifier !== "string")
          throw new HttpError(400, "INVALID_DEVICE_PROOF");
        const value = service.exchange(exchange[1], b.verifier);
        json(res, value.pending ? 202 : 200, value);
        return;
      }
      if (req.method === "GET" && url.pathname === "/v1/session") {
        json(res, 200, await service.status(token(req)));
        return;
      }
      if (req.method === "POST" && url.pathname === "/v1/logout") {
        await body(req);
        service.logout(token(req));
        json(res, 200, { ok: true });
        return;
      }
      throw new HttpError(404, "NOT_FOUND");
    } catch (e) {
      const known = e instanceof HttpError;
      json(res, known ? e.status : 500, {
        error: known ? e.code : "INTERNAL_ERROR",
      });
    }
  });
}
