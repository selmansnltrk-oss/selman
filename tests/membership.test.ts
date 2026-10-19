import { describe, it, expect, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store, digest, random } from "../server/src/store";
import { MembershipService } from "../server/src/service";
import { entitlement, PLANS, type WixOrder } from "../server/src/policy";
import { loadConfig } from "../server/src/config";
import { createMembershipServer } from "../server/src/http";
import type { Provider, OAuthData } from "../server/src/wix";
const now = Date.now(),
  planIds = Object.keys(PLANS),
  date = (offset: number) => new Date(now + offset).toISOString();
const base: WixOrder = {
  _id: "order",
  planId: planIds[0],
  buyer: { memberId: "member" },
  status: "ACTIVE",
  lastPaymentStatus: "PAID",
  startDate: date(-86400000),
  endDate: date(86400000),
  currentCycle: { index: 1, endedDate: date(86400000) },
};
const stores: Store[] = [];
afterEach(() => {
  for (const store of stores) store.close();
  stores.length = 0;
});
function fixture() {
  const store = new Store(":memory:", randomBytes(32));
  stores.push(store);
  let resultOrders: WixOrder[] = [structuredClone(base)],
    memberId = "member",
    offline = false;
  const oauth: OAuthData = {
    state: random(),
    codeVerifier: random(),
    codeChallenge: random(),
    redirectUri: "https://backend.example/auth/callback",
    originalUri: "https://backend.example/auth/callback",
  };
  const tokens = {
    accessToken: {
      value: "test-access-not-real",
      expiresAt: Math.floor(now / 1000) + 3600,
    },
    refreshToken: { value: "test-refresh-not-real", role: "member" },
  };
  const provider: Provider = {
    async begin() {
      return { oauth, url: "https://www.wix.com/test-only-login" };
    },
    async complete(code, state, data) {
      if (code !== "valid-test-code" || state !== data.state)
        throw Error("bad code");
      return tokens;
    },
    async inspect() {
      if (offline) throw Error("unavailable");
      return {
        tokens,
        member: {
          _id: memberId,
          name: "Test Member",
          email: "test@example.invalid",
        },
        orders: resultOrders,
      };
    },
  };
  const service = new MembershipService(
    store,
    provider,
    "https://backend.example",
  );
  return {
    store,
    service,
    oauth,
    setOrders: (o: WixOrder[]) => {
      resultOrders = o;
    },
    setMember: (id: string) => {
      memberId = id;
    },
    setOffline: () => {
      offline = true;
    },
  };
}
async function login(f: ReturnType<typeof fixture>) {
  const verifier = random(),
    attempt = f.service.createAttempt(digest(verifier));
  await f.service.begin(attempt.attemptId);
  await f.service.callback("valid-test-code", f.oauth.state);
  const exchange = f.service.exchange(attempt.attemptId, verifier);
  if (exchange.pending) throw Error("pending");
  return { token: exchange.sessionToken, attempt, verifier };
}
describe("Gerçek sipariş durumlarına dayalı erişim politikası (fixture testleri)", () => {
  it.each(planIds)("aktif %s planını üyelik sahibi için kabul eder", (id) =>
    expect(entitlement([{ ...base, planId: id }], "member", now)?.planId).toBe(
      id,
    ),
  );
  it.each(["PAUSED", "ENDED", "DRAFT", "PENDING", "UNDEFINED", "CANCELED"])(
    "%s durumunu varsayılan olarak engeller",
    (status) =>
      expect(entitlement([{ ...base, status }], "member", now)).toBeNull(),
  );
  it.each(["FAILED", "REFUNDED", "UNPAID", "PENDING", "UNDEFINED"])(
    "%s ödeme durumunda hak uydurmaz",
    (lastPaymentStatus) =>
      expect(
        entitlement([{ ...base, lastPaymentStatus }], "member", now),
      ).toBeNull(),
  );
  it("başkasının siparişini ve farklı planı reddeder", () => {
    expect(entitlement([base], "other", now)).toBeNull();
    expect(
      entitlement([{ ...base, planId: "other" }], "member", now),
    ).toBeNull();
  });
  it("süresi biten, ileri başlayan ve bozuk tarihi reddeder", () => {
    expect(
      entitlement([{ ...base, endDate: date(0) }], "member", now),
    ).toBeNull();
    expect(
      entitlement([{ ...base, startDate: date(1) }], "member", now),
    ).toBeNull();
    expect(
      entitlement([{ ...base, endDate: "bad" }], "member", now),
    ).toBeNull();
  });
  it("ödenmiş dönem sonundaki iptali gerçek endDate kadar kabul eder", () => {
    const r = entitlement(
      [
        {
          ...base,
          status: "CANCELED",
          autoRenewCanceled: true,
          cancellation: { effectiveAt: "NEXT_PAYMENT_DATE" },
        },
      ],
      "member",
      now,
    );
    expect(r?.accessUntil).toBe(base.endDate);
    expect(r?.nextRenewal).toBeNull();
    expect(
      entitlement(
        [
          {
            ...base,
            status: "CANCELED",
            cancellation: { effectiveAt: "IMMEDIATELY" },
          },
        ],
        "member",
        now,
      ),
    ).toBeNull();
    expect(
      entitlement(
        [
          {
            ...base,
            status: "CANCELED",
            endDate: null,
            cancellation: { effectiveAt: "NEXT_PAYMENT_DATE" },
          },
        ],
        "member",
        now,
      ),
    ).toBeNull();
  });
  it("bitiş tarihi olmayan aktif düzenli siparişe en çok beş dakika hak verir", () => {
    const r = entitlement(
      [{ ...base, endDate: null, currentCycle: undefined }],
      "member",
      now,
    )!;
    expect(+new Date(r.leaseUntil) - now).toBe(300000);
    expect(r.accessUntil).toBeNull();
  });
  it("aktif duraklatmayı engeller, süreli gerçek denemeyi sınırlar", () => {
    expect(
      entitlement(
        [{ ...base, pausePeriods: [{ status: "ACTIVE" }] }],
        "member",
        now,
      ),
    ).toBeNull();
    expect(
      entitlement(
        [
          {
            ...base,
            lastPaymentStatus: "NOT_APPLICABLE",
            currentCycle: { index: 0, endedDate: date(60000) },
          },
        ],
        "member",
        now,
      ),
    ).not.toBeNull();
    expect(
      entitlement(
        [
          {
            ...base,
            lastPaymentStatus: "NOT_APPLICABLE",
            currentCycle: undefined,
          },
        ],
        "member",
        now,
      ),
    ).toBeNull();
  });
});
describe("Sunucu OAuth, oturum ve doğrulama", () => {
  it("PKCE verisi, yanlış state, yanlış cihaz ispatı ve tekrar kullanımı kontrol eder", async () => {
    const f = fixture(),
      verifier = random(),
      a = f.service.createAttempt(digest(verifier));
    await expect(f.service.callback("x", "wrong-state")).rejects.toMatchObject({
      status: 400,
    });
    expect(() => f.service.exchange(a.attemptId, random())).toThrow();
    expect(f.service.exchange(a.attemptId, verifier).pending).toBe(true);
    await f.service.begin(a.attemptId);
    await f.service.callback("valid-test-code", f.oauth.state);
    const result = f.service.exchange(a.attemptId, verifier);
    expect(result.pending).toBe(false);
    expect(() => f.service.exchange(a.attemptId, verifier)).toThrow();
    await expect(
      f.service.callback("valid-test-code", f.oauth.state),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("her kontrolde üyeyi ve aboneliği yeniden doğrular; iptal ve kesinti erişimi kapatır", async () => {
    const f = fixture(),
      { token } = await login(f);
    expect((await f.service.status(token)).access).toBe(true);
    f.setOrders([]);
    expect((await f.service.status(token)).access).toBe(false);
    f.setOffline();
    await expect(f.service.status(token)).rejects.toMatchObject({
      status: 503,
    });
  });
  it("kimlik değişimini reddeder ve oturumu iptal eder", async () => {
    const f = fixture(),
      { token } = await login(f);
    f.setMember("attacker");
    await expect(f.service.status(token)).rejects.toMatchObject({
      status: 401,
    });
    f.setMember("member");
    await expect(f.service.status(token)).rejects.toMatchObject({
      status: 401,
    });
  });
  it("çıkış yapılan ve bilinmeyen oturumu reddeder", async () => {
    const f = fixture(),
      { token } = await login(f);
    f.service.logout(token);
    await expect(f.service.status(token)).rejects.toMatchObject({
      status: 401,
    });
    await expect(f.service.status(random())).rejects.toMatchObject({
      status: 401,
    });
  });
  it("SQLite tekrar açılınca oturum korunur; tokenlar dosyaya düz yazılmaz", () => {
    const dir = mkdtempSync(join(tmpdir(), "defter-auth-")),
      file = join(dir, "auth.sqlite"),
      key = randomBytes(32);
    let s = new Store(file, key);
    try {
      s.put(
        "session",
        "hashed-token",
        { secret: "WIX_REFRESH_SECRET_TEST" },
        Date.now() + 10000,
      );
      s.close();
      s = new Store(file, key);
      expect(
        s.get<{ secret: string }>("session", "hashed-token")?.value.secret,
      ).toBe("WIX_REFRESH_SECRET_TEST");
      expect(
        readFileSync(file).includes(Buffer.from("WIX_REFRESH_SECRET_TEST")),
      ).toBe(false);
    } finally {
      s.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("HTTP API bearer, CORS ve Content-Type denetimi yapar; memberId parametresine güvenmez", async () => {
    const f = fixture(),
      server = createMembershipServer(f.service, "https://backend.example");
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw Error("address");
    const url = "http://127.0.0.1:" + addr.port;
    try {
      const noAuth = await fetch(url + "/v1/session?memberId=member");
      expect(noAuth.status).toBe(401);
      expect(noAuth.headers.get("cache-control")).toBe("no-store");
      expect(
        (
          await fetch(url + "/v1/auth/attempts", {
            method: "POST",
            headers: {
              Origin: "https://evil.invalid",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ challenge: digest(random()) }),
          })
        ).status,
      ).toBe(403);
      expect(
        (await fetch(url + "/v1/auth/attempts", { method: "POST", body: "{}" }))
          .status,
      ).toBe(415);
      const { token } = await login(f);
      const response = await fetch(url + "/v1/session?memberId=attacker", {
        headers: { Authorization: "Bearer " + token },
      });
      expect((await response.json()).member._id).toBe("member");
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
  it("üretimde eksik kimlik bilgilerini ve HTTP originini reddeder", () => {
    expect(() => loadConfig({})).toThrow();
    expect(() =>
      loadConfig({
        WIX_CLIENT_ID: "00000000-0000-4000-8000-000000000001",
        WIX_SITE_ID: "ece5420a-0b61-4879-8872-0e899f7628b5",
        SERVER_DATA_KEY: randomBytes(32).toString("base64"),
        PUBLIC_ORIGIN: "http://localhost:8787",
        ALLOW_LOCAL_HTTP: "true",
      }),
    ).toThrow();
  });
});
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createVault } = require("../electron/session-vault.cjs");
it("Electron kasası şifreleme yokken düz metin yazmaz ve şifreli oturumu siler", () => {
  const dir = mkdtempSync(join(tmpdir(), "defter-vault-")),
    file = join(dir, "session.bin");
  try {
    const unsupported = createVault(
      { isEncryptionAvailable: () => false },
      file,
    );
    expect(() => unsupported.write(random())).toThrow();
    const token = random(),
      mock = {
        isEncryptionAvailable: () => true,
        encryptString: (value: string) =>
          Buffer.from("cipher:" + Buffer.from(value).toString("base64")),
        decryptString: (value: Buffer) =>
          Buffer.from(value.toString().slice(7), "base64").toString(),
      };
    const vault = createVault(mock, file);
    vault.write(token);
    expect(readFileSync(file).includes(Buffer.from(token))).toBe(false);
    expect(vault.read()).toBe(token);
    vault.clear();
    expect(vault.read()).toBeNull();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it("otomatik yenileme iptalinde gerçek bitiş tarihi olmadan süre uydurmaz", () => {
  expect(
    entitlement(
      [{ ...base, autoRenewCanceled: true, endDate: null }],
      "member",
      now,
    ),
  ).toBeNull();
});
