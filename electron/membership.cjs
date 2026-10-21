const { performance } = require("node:perf_hooks");
const { randomBytes, createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { z } = require("zod");
const { apiOrigin } = require("./membership-config.json");
const { createVault } = require("./session-vault.cjs");
const iso = z.string().datetime({ offset: true });
const payload = z.object({
  member: z.object({
    _id: z.string().min(1).max(100),
    name: z.string().max(200),
    email: z.string().max(320),
  }),
  access: z.boolean(),
  subscription: z
    .object({
      orderId: z.string(),
      planId: z.enum([
        "e8ad2153-8cfb-4f1a-ad5a-7819a781ec42",
        "77a5c1a3-b8b6-4669-b346-570a06a05778",
      ]),
      planName: z.string(),
      status: z.enum(["ACTIVE", "CANCELED"]),
      paymentStatus: z.string(),
      autoRenewCanceled: z.boolean(),
      accessUntil: iso.nullable(),
      nextRenewal: iso.nullable(),
      leaseUntil: iso,
    })
    .nullable(),
  checkedAt: iso,
  leaseUntil: iso.nullable(),
});
function createMembership({ safeStorage, userData, openExternal, onChange }) {
  const vault = createVault(
    safeStorage,
    path.join(userData, "membership-session.bin"),
  );
  let token = null,
    deadline = 0,
    expiresWall = 0,
    state = { phase: apiOrigin ? "signed-out" : "unconfigured", access: false },
    generation = 0,
    pending = null;
  const ownerPath = path.join(userData, "membership-owner.json");
  const publish = (next) => {
    state = next;
    onChange(state);
    return state;
  };
  const locked = (phase, message) => {
    deadline = 0;
    expiresWall = 0;
    return publish({
      phase,
      access: false,
      ...(state.member ? { member: state.member } : {}),
      message,
    });
  };
  async function request(
    route,
    { method = "GET", body, authorized = true } = {},
  ) {
    if (!apiOrigin) throw Error("CONFIG_MISSING");
    const url = new URL(apiOrigin);
    if (url.protocol !== "https:" || url.origin !== apiOrigin)
      throw Error("CONFIG_INVALID");
    const sentToken = authorized ? token : null;
    const r = await fetch(apiOrigin + route, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(sentToken ? { Authorization: "Bearer " + sentToken } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    if (r.status === 401) {
      if (token === sentToken) {
        token = null;
        vault.clear();
      }
      throw Error("SESSION_EXPIRED");
    }
    if (!r.ok) throw Error("API_UNAVAILABLE");
    return r.json();
  }
  async function check() {
    if (!apiOrigin) return state;
    if (state.phase === "waiting") return state;
    if (!token) return locked("signed-out", "Wix hesabınızla giriş yapın.");
    if (pending && pending.turn === generation) return pending.promise;
    const turn = generation;
    const operation = (async () => {
      try {
        const value = payload.parse(await request("/v1/session"));
        if (turn !== generation) return state;
        if (!value.access || !value.subscription || !value.leaseUntil)
          return publish({
            phase: "inactive",
            access: false,
            member: value.member,
            message: "Aktif aboneliğiniz bulunmuyor.",
          });
        const expiry = Math.min(
          Date.parse(value.leaseUntil),
          Date.now() + 5 * 60_000,
          value.subscription.accessUntil
            ? Date.parse(value.subscription.accessUntil)
            : Infinity,
        );
        if (expiry <= Date.now())
          return locked("error", "Abonelik yeniden doğrulanmalı.");
        const owner = createHash("sha256")
          .update(value.member._id)
          .digest("hex");
        if (fs.existsSync(ownerPath)) {
          const saved = JSON.parse(fs.readFileSync(ownerPath, "utf8"));
          if (saved.owner !== owner) {
            deadline = 0;
            expiresWall = 0;
            return publish({
              phase: "different-account",
              access: false,
              member: value.member,
              message:
                "Bu bilgisayarın kayıtları başka bir üyeliğe bağlı. Kayıtlarınız korunuyor; önceki hesapla giriş yapın.",
            });
          }
        } else
          fs.writeFileSync(ownerPath, JSON.stringify({ owner }), {
            flag: "wx",
            mode: 0o600,
          });
        deadline = performance.now() + Math.max(0, expiry - Date.now());
        expiresWall = expiry;
        return publish({
          phase: "active",
          access: true,
          member: value.member,
          subscription: value.subscription,
          checkedAt: value.checkedAt,
          leaseUntil: new Date(expiry).toISOString(),
        });
      } catch (e) {
        if (turn !== generation) return state;
        return locked(
          e.message === "SESSION_EXPIRED" ? "signed-out" : "error",
          e.message === "SESSION_EXPIRED"
            ? "Oturumunuz sona erdi. Yeniden giriş yapın."
            : "Abonelik doğrulanamadı. İnternet bağlantısını kontrol edip tekrar deneyin.",
        );
      } finally {
        if (pending?.turn === turn) pending = null;
      }
    })();
    pending = { turn, promise: operation };
    return operation;
  }
  function allowed() {
    return (
      state.phase === "active" &&
      state.access &&
      performance.now() < deadline &&
      Date.now() < expiresWall
    );
  }
  async function assertAccess() {
    if (!allowed()) await check();
    if (!allowed())
      throw Error(
        "Aktif abonelik doğrulanmadan finans kayıtlarına erişilemez.",
      );
  }
  async function initialize() {
    if (!apiOrigin) return state;
    try {
      token = vault.read();
    } catch {
      return locked(
        "error",
        "Güvenli oturum deposu açılamadı. Yeniden giriş yapın.",
      );
    }
    if (token) return check();
    return state;
  }
  async function login() {
    if (!apiOrigin)
      return locked("unconfigured", "Üyelik sunucusu henüz yapılandırılmadı.");
    const turn = ++generation;
    deadline = 0;
    expiresWall = 0;
    publish({
      phase: "waiting",
      access: false,
      message: "Tarayıcınızda Wix girişini tamamlayın.",
    });
    try {
      const verifier = randomBytes(32).toString("base64url"),
        challenge = createHash("sha256").update(verifier).digest("base64url");
      const attempt = await request("/v1/auth/attempts", {
        method: "POST",
        body: { challenge },
        authorized: false,
      });
      if (
        !/^[A-Za-z0-9_-]{43}$/.test(attempt.attemptId) ||
        attempt.browserUrl !== apiOrigin + "/auth/start/" + attempt.attemptId
      )
        throw Error("INVALID_LOGIN_URL");
      await openExternal(attempt.browserUrl);
      const until = Math.min(
        Date.parse(attempt.expiresAt),
        Date.now() + 10 * 60_000,
      );
      while (turn === generation && Date.now() < until) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        if (turn !== generation) return state;
        const response = await request(
          `/v1/auth/attempts/${attempt.attemptId}/exchange`,
          { method: "POST", body: { verifier }, authorized: false },
        );
        if (!response.pending) {
          if (!/^[A-Za-z0-9_-]{43}$/.test(response.sessionToken))
            throw Error("INVALID_SESSION");
          if (turn !== generation) return state;
          vault.write(response.sessionToken);
          token = response.sessionToken;
          state = { phase: "checking", access: false };
          return check();
        }
      }
      if (turn === generation)
        return locked("signed-out", "Giriş süresi doldu. Tekrar deneyin.");
      return state;
    } catch {
      if (turn === generation)
        return locked("error", "Giriş tamamlanamadı. Tekrar deneyin.");
      return state;
    }
  }
  async function logout() {
    ++generation;
    deadline = 0;
    expiresWall = 0;
    const saved = token;
    token = null;
    vault.clear();
    publish({
      phase: apiOrigin ? "signed-out" : "unconfigured",
      access: false,
    });
    if (saved)
      try {
        await fetch(apiOrigin + "/v1/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + saved,
          },
          body: "{}",
          signal: AbortSignal.timeout(10000),
          redirect: "error",
        });
      } catch {}
    return state;
  }
  const timer = setInterval(() => {
    if (token) void check();
  }, 120000);
  timer.unref();
  const expiryTimer = setInterval(() => {
    if (state.phase === "active" && !allowed())
      locked("error", "Abonelik kontrol süresi doldu. Tekrar kontrol edin.");
  }, 1000);
  expiryTimer.unref();
  return {
    initialize,
    login,
    logout,
    check,
    assertAccess,
    allowed,
    getState: () => state,
    openWebsite: () => openExternal("https://www.deftermini.com/"),
    stop: () => {
      ++generation;
      clearInterval(timer);
      clearInterval(expiryTimer);
    },
  };
}
module.exports = { createMembership };
