import { test, expect } from "@playwright/test";
test("yapılandırılmamış üretim arayüzü finans ekranlarını açmaz", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Üyelik sunucusu henüz yapılandırılmadı.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Wix hesabıyla giriş yap" }),
  ).toBeDisabled();
  await expect(page.locator("nav")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Günü kaydet" })).toHaveCount(
    0,
  );
  await page.screenshot({
    path: "/tmp/defter-membership-login.png",
    fullPage: true,
  });
});
test("abonelik yoksa kilitli kalır, abonelik doğrulanınca açılır, iptalde kapanır", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let listener: ((v: unknown) => void) | undefined;
    const inactive = {
      phase: "inactive",
      access: false,
      member: { _id: "test", name: "Test User", email: "user@example.invalid" },
    };
    Object.assign(window, {
      defterMembership: {
        state: async () => inactive,
        check: async () => ({
          phase: "active",
          access: true,
          member: inactive.member,
          subscription: {
            planName: "Yıllık Üyelik",
            status: "ACTIVE",
            autoRenewCanceled: false,
            accessUntil: "2099-01-01T00:00:00.000Z",
            nextRenewal: null,
          },
          leaseUntil: new Date(Date.now() + 60000).toISOString(),
        }),
        login: async () => inactive,
        logout: async () => ({ phase: "signed-out", access: false }),
        website: async () => {},
        subscribe: (fn: (v: unknown) => void) => {
          listener = fn;
          return () => {};
        },
      },
      emitMembership: (value: unknown) => listener?.(value),
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Aktif aboneliğiniz bulunmuyor." }),
  ).toBeVisible();
  await expect(page.locator("nav")).toHaveCount(0);
  await page.getByRole("button", { name: "Tekrar Kontrol Et" }).click();
  await expect(page.locator("nav")).toBeVisible();
  await expect(page.locator(".membership-toolbar")).toContainText(
    "Yıllık Üyelik",
  );
  await page.evaluate(() => {
    (
      window as unknown as { emitMembership: (value: unknown) => void }
    ).emitMembership({
      phase: "error",
      access: false,
      message: "Abonelik doğrulanamadı.",
    });
  });
  await expect(page.locator("nav")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Günü kaydet" })).toHaveCount(
    0,
  );
});
