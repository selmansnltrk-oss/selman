import { test, expect } from "@playwright/test";
test("günlük giriş, hesaplama, SQLite kaydı, düzenleme, filtre, yeniden açma ve yedek", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Günü kaydet" })).toBeEnabled();
  await page.getByLabel("Yemeksepeti geliri").fill("2749,45");
  await page.getByLabel("Yemeksepeti geliri").blur();
  await page.getByLabel("Yeni personel adı").fill("Test Personel");
  await page
    .getByRole("button", { name: "Personel ekle", exact: true })
    .click();
  await page.getByLabel("Test Personel Günlük ücret").fill("500");
  await page.getByLabel("Test Personel Günlük ücret").blur();
  await page.getByLabel("Yeni gider açıklaması").fill("Test ekmek");
  await page.getByRole("button", { name: "Gider ekle", exact: true }).click();
  await page.getByLabel("Test ekmek tutarı").fill("20");
  await page.getByLabel("Test ekmek tutarı").blur();
  await page.getByRole("button", { name: "Hesapla", exact: true }).click();
  await expect(page.getByText("₺2.229,45", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Günü kaydet" }).click();
  await expect(page.getByText("Günün kaydı güvenle saklandı.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Yemeksepeti geliri")).toHaveValue("2.749,45");
  await page.getByRole("button", { name: "Kasa", exact: true }).click();
  await expect(page.locator(".record")).toHaveCount(1);
  await page.locator(".record").click();
  await expect(
    page.getByRole("heading", { name: "Personel maliyetleri" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Düzenle", exact: true }).click();
  await page.getByLabel("Yemeksepeti geliri").fill("3000");
  await page.getByLabel("Yemeksepeti geliri").blur();
  await page.getByRole("button", { name: "Günü kaydet" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Kaydı güncelle" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Kasa", exact: true }).click();
  await expect(page.locator(".record")).toHaveCount(1);
  await page
    .locator("nav")
    .getByRole("button", { name: "Ayarlar", exact: true })
    .click();
  await page.getByLabel("İşletme adı", { exact: true }).fill("Test Kafe");
  await page.getByRole("button", { name: "Ayarları kaydet" }).click();
  await expect(page.getByText("İşletme ayarlarınız kaydedildi.")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Yedek al", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page.reload();
  await expect(page.locator(".business")).toContainText("Test Kafe");
  await page
    .locator("nav")
    .getByRole("button", { name: "Ayarlar", exact: true })
    .click();
  page.on("dialog", (d) => d.accept());
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Geri yükle", exact: true }).click();
  await (await chooserPromise).setFiles(path!);
  await expect(page.getByText("Yedek geri yüklendi.")).toBeVisible();
  await page.getByRole("button", { name: "Kasa", exact: true }).click();
  await page.getByLabel("Başlangıç tarihi").fill("2000-01-01");
  await page.getByLabel("Bitiş tarihi").fill("2000-01-02");
  await page.getByRole("button", { name: "Filtrele" }).click();
  await expect(page.locator(".record")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("demo ve mobil ekranlarda taşma yok", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Demoyu dene" }).click();
  await expect(
    page.getByText("7 örnek gün eklendi. Mevcut kayıtlar korundu."),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/defter-icmal.png", fullPage: true });
  await page.getByRole("button", { name: "Kasa", exact: true }).click();
  await page.screenshot({ path: "/tmp/defter-kasa.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const tab of ["İcmal", "Kasa", "Ayarlar"]) {
    await page
      .locator("nav")
      .getByRole("button", { name: tab, exact: true })
      .click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  }
  await page.screenshot({ path: "/tmp/defter-mobile.png", fullPage: true });
});

test("ayarlar girilmiş bugüne uygulanır, kira muhasebe komisyon ve vergi sonucu düşülür", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Günü kaydet" })).toBeEnabled();
  await page.getByLabel("Yemeksepeti geliri").fill("10000");
  await page.getByLabel("Yemeksepeti geliri").blur();
  await page.getByRole("button", { name: "Günü kaydet" }).click();
  await expect(page.getByText("Günün kaydı güvenle saklandı.")).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Ayarlar", exact: true })
    .click();
  await page.getByLabel("Şirket tipi", { exact: true }).selectOption("Limited");
  const fixed = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: "Aylık sabit giderler",
        exact: true,
      }),
    });
  await fixed.getByLabel("Sabit gider gün esası").selectOption("30");
  await fixed
    .locator("label")
    .filter({ hasText: "Aylık kira" })
    .locator("input")
    .fill("30000");
  await fixed
    .locator("label")
    .filter({ hasText: "Muhasebe ücreti" })
    .locator("input")
    .fill("3000");
  const channels = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", { name: "Satış kanalları", exact: true }),
    });
  await channels
    .locator(".config-row")
    .first()
    .getByLabel("Komisyon yüzdesi")
    .fill("20");
  await page.getByLabel("Tahmini vergi analizini etkinleştir").check();
  await page
    .getByLabel(
      "Vergi yılı, tarife, yöntem, açılış matrahı ve varsa ortak bilgilerini mali müşavirimle kontrol ettim.",
    )
    .check();
  await page.getByRole("button", { name: "Ayarları kaydet" }).click();
  await expect(page.getByText("İşletme ayarlarınız kaydedildi.")).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "İcmal", exact: true })
    .click();
  await expect(page.getByLabel("Yemeksepeti geliri")).toHaveValue("10.000,00");
  await expect(page.locator(".fixed-strip")).toContainText("₺1.100,00");
  await page
    .getByText("KDV ve günlük vergi bilgileri", { exact: true })
    .click();
  await page
    .locator(".vat-line")
    .filter({ hasText: "Yemeksepeti" })
    .getByLabel("Komisyon yüzdesi")
    .fill("20");
  await page.getByRole("button", { name: "Hesapla", exact: true }).click();
  await expect(page.locator(".breakdown")).toContainText("₺2.000,00");
  const value = (label: string) =>
    page.locator(".tax-value").filter({ hasText: label });
  await expect(value("Vergi öncesi sonuç")).toContainText("₺5.233,33");
  await expect(value("Gelir / kurumlar vergi karşılığı")).toContainText(
    "₺1.308,33",
  );
  await expect(value("Vergi sonrası sonuç")).toContainText("₺3.925,00");
  await page.getByRole("button", { name: "Günü kaydet" }).click();
  await page.getByRole("button", { name: "Kaydı güncelle" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Yemeksepeti geliri")).toHaveValue("10.000,00");
  await page.getByRole("button", { name: "Hesapla", exact: true }).click();
  await expect(value("Vergi sonrası sonuç")).toContainText("₺3.925,00");
  await page.screenshot({ path: "/tmp/defter-v1.1-tax.png", fullPage: true });
  await page
    .locator("nav")
    .getByRole("button", { name: "Kasa", exact: true })
    .click();
  await expect(page.locator(".tax-report")).toContainText("₺1.308,33");
});
