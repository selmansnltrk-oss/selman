import { it, expect } from "vitest";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import {
  readFileSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
const token = "t".repeat(43);
function harness() {
  const dir = mkdtempSync(join(tmpdir(), "defter-controller-"));
  let mono = 0,
    offline = false,
    member = "member-a",
    active = true,
    rejectSession = false;
  const calls: {
      url: string;
      body: Record<string, unknown>;
      auth: string | undefined;
    }[] = [],
    opened: string[] = [];
  const status = () => ({
    member: {
      _id: member,
      name: "Test Member",
      email: "fixture@example.invalid",
    },
    access: active,
    subscription: active
      ? {
          orderId: "order",
          planId: "8ca42153-8cfb-4f1a-ad5a-7819a781ec42",
          planName: "Aylık Üyelik",
          status: "ACTIVE",
          paymentStatus: "PAID",
          autoRenewCanceled: false,
          accessUntil: null,
          nextRenewal: null,
          leaseUntil: new Date(Date.now() + 3600000).toISOString(),
        }
      : null,
    checkedAt: new Date().toISOString(),
    leaseUntil: active ? new Date(Date.now() + 3600000).toISOString() : null,
  });
  const cipher = {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) =>
      Buffer.from("fixture:" + Buffer.from(s).toString("base64")),
    decryptString: (s: Buffer) =>
      Buffer.from(s.toString().slice(8), "base64").toString(),
  };
  const sandbox = {
    module: { exports: {} },
    require: (name: string) =>
      name === "./membership-config.json"
        ? { apiOrigin: "https://backend.example" }
        : name === "node:perf_hooks"
          ? { performance: { now: () => mono } }
          : name === "./session-vault.cjs"
            ? require("../electron/session-vault.cjs")
            : require(name),
    Buffer,
    URL,
    AbortSignal,
    setInterval,
    clearInterval,
    setTimeout: (fn: () => void, ms: number) =>
      ms === 2500 ? setTimeout(fn, 0) : setTimeout(fn, ms),
    fetch: async (url: string, options: RequestInit = {}) => {
      if (offline) throw Error("network down");
      const body = JSON.parse(String(options.body ?? "{}")),
        auth = (options.headers as Record<string, string>)?.Authorization;
      calls.push({ url, body, auth });
      if (rejectSession && url.endsWith("/v1/session"))
        return new Response("{}", { status: 401 });
      if (url.endsWith("/v1/session")) return Response.json(status());
      if (url.endsWith("/v1/auth/attempts"))
        return Response.json({
          attemptId: "a".repeat(43),
          browserUrl: "https://backend.example/auth/start/" + "a".repeat(43),
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        });
      if (url.endsWith("/exchange"))
        return Response.json({ pending: false, sessionToken: token });
      return Response.json({ ok: true });
    },
  };
  runInNewContext(
    readFileSync(
      new URL("../electron/membership.cjs", import.meta.url),
      "utf8",
    ),
    sandbox,
  );
  const { createMembership } = sandbox.module.exports as {
    createMembership: (options: unknown) => any;
  };
  const controller = createMembership({
    safeStorage: cipher,
    userData: dir,
    openExternal: async (url: string) => opened.push(url),
    onChange: () => {},
  });
  return {
    controller,
    dir,
    calls,
    opened,
    seed: () =>
      writeFileSync(
        join(dir, "membership-session.bin"),
        cipher.encryptString(token),
      ),
    setOffline: () => {
      offline = true;
    },
    setInactive: () => {
      active = false;
    },
    setOther: () => {
      member = "member-b";
    },
    setExpired: () => {
      mono = 300001;
    },
    rejectSession: () => {
      rejectSession = true;
    },
    close: () => {
      controller.stop();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
it("gerçek kontrolör oturum tokenını renderer durumuna açmadan backend yanıtını en çok 5 dakika kullanır", async () => {
  const f = harness();
  try {
    f.seed();
    await f.controller.initialize();
    expect(f.controller.allowed()).toBe(true);
    expect(JSON.stringify(f.controller.getState())).not.toContain(token);
    expect(f.calls.at(-1)?.auth).toBe("Bearer " + token);
    f.setExpired();
    expect(f.controller.allowed()).toBe(false);
  } finally {
    f.close();
  }
});
it("gerçek kontrolör abonelik iptalinde ve ağ hatasında kilitler", async () => {
  for (const kind of ["inactive", "offline"]) {
    const f = harness();
    try {
      f.seed();
      await f.controller.initialize();
      if (kind === "inactive") f.setInactive();
      else f.setOffline();
      await f.controller.check();
      expect(f.controller.allowed()).toBe(false);
      await expect(f.controller.assertAccess()).rejects.toThrow();
    } finally {
      f.close();
    }
  }
});
it("cihaz PKCE değişimiyle hosted tarayıcı akışı tamamlanır; çıkış kasa dosyasını siler", async () => {
  const f = harness();
  try {
    await f.controller.login();
    expect(f.controller.allowed()).toBe(true);
    expect(f.opened[0]).toBe(
      "https://backend.example/auth/start/" + "a".repeat(43),
    );
    const challenge = f.calls.find((c) => c.url.endsWith("/v1/auth/attempts"))
      ?.body.challenge;
    const verifier = f.calls.find((c) => c.url.endsWith("/exchange"))?.body
      .verifier;
    expect(
      createHash("sha256").update(String(verifier)).digest("base64url"),
    ).toBe(challenge);
    expect(existsSync(join(f.dir, "membership-session.bin"))).toBe(true);
    await f.controller.logout();
    expect(f.controller.allowed()).toBe(false);
    expect(existsSync(join(f.dir, "membership-session.bin"))).toBe(false);
  } finally {
    f.close();
  }
});
it("aynı bilgisayarın finans kayıtlarını başka bir Wix üyesine açmaz", async () => {
  const f = harness();
  try {
    f.seed();
    await f.controller.initialize();
    f.setOther();
    await f.controller.check();
    expect(f.controller.allowed()).toBe(false);
    expect(f.controller.getState().phase).toBe("different-account");
  } finally {
    f.close();
  }
});
it("sunucu 401 döndürdüğünde kalıcı yerel oturum silinir", async () => {
  const f = harness();
  try {
    f.seed();
    await f.controller.initialize();
    f.rejectSession();
    await f.controller.check();
    expect(f.controller.allowed()).toBe(false);
    expect(existsSync(join(f.dir, "membership-session.bin"))).toBe(false);
  } finally {
    f.close();
  }
});
