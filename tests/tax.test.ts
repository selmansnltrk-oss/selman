import { describe, it, expect } from "vitest";
import {
  taxProfile,
  progressiveTax,
  splitVat,
  taxLedger,
  taxTotals,
  taxSettingsSchema,
} from "../src/tax";
import {
  defaults,
  newDay,
  applySettingsToDay,
  calculate,
  settingsSchema,
  daySchema,
  type Day,
} from "../src/model";
function day(date = "2026-01-01", company = "Şahıs") {
  const tax = taxProfile(company);
  tax.enabled = true;
  tax.confirmed = true;
  tax.vatDefault = 0;
  return newDay({ ...defaults, company, tax }, date);
}
function sale(amount: number, date = "2026-01-01", company = "Şahıs") {
  const d = day(date, company);
  d.incomes[0].amount = amount;
  return d;
}
describe("Ayar aktarımı ve sabit giderler", () => {
  it("girilen satış, gider ve personeli koruyarak kirayı, muhasebeyi ve panel oranlarını uygular", () => {
    const d = newDay(defaults, "2026-10-19");
    d.incomes[0].amount = 1000000;
    d.note = "Korunmalı";
    d.employees = [
      {
        id: "e",
        name: "Elif",
        wage: 50000,
        bonus: 0,
        insurance: 0,
        other: 0,
        payment: 0,
      },
    ];
    const s = {
      ...defaults,
      rent: 3000000,
      accounting: 300000,
      fixedBasis: "30" as const,
      channels: defaults.channels.map((c) => ({ ...c, rate: 1000 })),
    };
    const next = applySettingsToDay(d, s);
    expect(next.incomes[0].amount).toBe(1000000);
    expect(next.employees).toEqual(d.employees);
    expect(next.note).toBe(d.note);
    expect(next.fixed).toBe(110000);
    expect(calculate(next).platform).toBe(100000);
    expect(calculate(next).result).toBe(740000);
    expect(d.fixed).toBe(0);
  });
  it("30 gün ve takvim günü seçeneklerini ayrı hesaplar", () => {
    const s = { ...defaults, rent: 3000000 };
    expect(newDay({ ...s, fixedBasis: "30" }, "2026-02-01").fixed).toBe(100000);
    expect(newDay(s, "2026-02-01").fixed).toBe(107143);
  });
  it("eski kayıt ve ayarlar ek vergi alanları olmadan açılır", () => {
    expect(settingsSchema.safeParse(defaults).success).toBe(true);
    const d = newDay(defaults);
    delete d.tax;
    delete d.fixedDetails;
    delete d.taxCosts;
    expect(daySchema.safeParse(d).success).toBe(true);
  });
});
describe("KDV ve kümülatif vergi", () => {
  it("1200 TL içinde 200 TL KDV ayrıştırır, hariç tutarı da brütleştirir", () => {
    expect(splitVat(120000, 2000, true)).toEqual({
      net: 100000,
      vat: 20000,
      gross: 120000,
    });
    expect(splitVat(100000, 2000, false)).toEqual({
      net: 100000,
      vat: 20000,
      gross: 120000,
    });
  });
  it("190 bin eşiği aşıldığında sadece aşan kısmı %20 ile vergiler", () => {
    const p = taxProfile("Şahıs");
    expect(progressiveTax(20000000, p.brackets)).toBe(3050000);
    expect(progressiveTax(19000000, p.brackets)).toBe(2850000);
  });
  it("tüm tarife dilimlerini ve sıfır/negatif matrahı hesaplar", () => {
    const p = taxProfile("Şahıs");
    expect(progressiveTax(-1, p.brackets)).toBe(0);
    expect(progressiveTax(0, p.brackets)).toBe(0);
    expect(progressiveTax(540000000, p.brackets)).toBe(177750000);
  });
  it("günlük karşılık yıllık kümülatif farktır, geçmiş gün değişince sonraki gün yeniden hesaplanır", () => {
    const a = sale(18900000),
      b = sale(200000, "2026-01-02");
    let l = taxLedger([b, a]);
    expect(l[1].reserve).toBe(35000);
    a.incomes[0].amount = 19000000;
    l = taxLedger([a, b]);
    expect(l[1].reserve).toBe(40000);
    expect(taxTotals(l).reserve).toBe(
      progressiveTax(19200000, a.tax!.brackets),
    );
  });
  it("kurumlar vergisi ciro yerine gider sonrası kazanca uygulanır", () => {
    const d = sale(100000, "2026-01-01", "Limited");
    d.fixed = 60000;
    const r = taxLedger([d])[0];
    expect(r.before).toBe(40000);
    expect(r.reserve).toBe(10000);
    expect(r.after).toBe(30000);
  });
  it("belge ve uygunluk onayı olmadığında KDV indirimi yapmaz", () => {
    const d = sale(120000, "2026-01-01", "Limited");
    d.incomes[0].vat = 2000;
    d.expenses = [
      {
        id: "x",
        description: "Malzeme",
        category: "Malzeme",
        date: d.date,
        amount: 24000,
        vat: 2000,
        invoice: true,
      },
    ];
    expect(taxLedger([d])[0].inputVat).toBe(0);
    d.expenses[0].vatDeductible = true;
    const r = taxLedger([d])[0];
    expect(r.inputVat).toBe(4000);
    expect(r.before).toBe(80000);
    expect(r.reserve).toBe(20000);
    expect(r.after).toBe(60000);
    expect(r.vatDue).toBe(16000);
    d.expenses[0].invoice = false;
    expect(taxLedger([d])[0].inputVat).toBe(0);
  });
  it("KDV hariç girişte POS toplamını gerçek brüt gelirle karşılaştırır ve komisyonu brütten hesaplar", () => {
    const d = sale(100000);
    d.incomes[0].vatIncluded = false;
    d.incomes[0].vat = 2000;
    d.incomes[0].rate = 1000;
    d.pos[0].amount = 120000;
    expect(calculate(d).gross).toBe(120000);
    expect(calculate(d).platform).toBe(12000);
    expect(taxLedger([d])[0].before).toBe(88000);
  });
  it("net tahsilatın vergi ve KDV bilgisini uydurmaz", () => {
    const d = sale(100000);
    d.incomes[0].mode = "net";
    expect(taxLedger([d])[0].reserve).toBeNull();
    expect(taxLedger([d])[0].outputVat).toBeNull();
  });
  it("teyitsiz, yılı yanlış ve profili eksik kayıtlarda sonuç üretmez", () => {
    const d = sale(100000);
    d.tax!.confirmed = false;
    expect(taxLedger([d])[0].reserve).toBeNull();
    d.tax!.confirmed = true;
    d.tax!.year = 2025;
    expect(taxLedger([d])[0].reserve).toBeNull();
    delete d.tax;
    expect(taxLedger([d])[0].reserve).toBeNull();
  });
  it("bir önceki günün eksik bilgisi sonraki yıllık karşılığı bloke eder", () => {
    const a = sale(100000),
      b = sale(100000, "2026-01-02");
    a.tax!.confirmed = false;
    const r = taxLedger([a, b])[1];
    expect(r.before).toBe(100000);
    expect(r.reserve).toBeNull();
    expect(r.vatDue).toBeNull();
  });
  it("yeni yılda kümülatif matrahı sıfırlar", () => {
    const a = sale(19000000, "2026-12-31"),
      b = sale(100000, "2027-01-01");
    b.tax!.year = 2027;
    expect(taxLedger([a, b])[1].reserve).toBe(15000);
  });
  it("zarar karşılığı azaltır, negatif karşılık iade olarak sunulmaz", () => {
    const a = sale(100000),
      b = sale(0, "2026-01-02");
    b.fixed = 50000;
    const r = taxLedger([a, b])[1];
    expect(r.reserve).toBe(-7500);
    expect(r.after).toBe(-42500);
  });
  it("matrah düzeltmeleri işletme sonucunu ikinci kez değiştirmez", () => {
    const d = sale(100000, "2026-01-01", "Limited");
    d.taxAdjustment = { additions: 20000, deductions: 10000 };
    expect(taxLedger([d])[0].before).toBe(100000);
    expect(taxLedger([d])[0].reserve).toBe(27500);
  });
  it("geçici veya fiili vergi ödemelerini yeniden gider düşmez", () => {
    const d = sale(100000);
    const before = taxLedger([d])[0];
    d.taxPaid = 15000;
    const after = taxLedger([d])[0];
    expect(after.after).toBe(before.after);
    expect(taxTotals([after]).paid).toBe(15000);
  });
  it("açılış KDV kredisi kullanılır ve negatif bakiye sonraki aya devreder", () => {
    const a = sale(120000);
    a.incomes[0].vat = 2000;
    a.tax!.openingVat = 50000;
    const b = sale(120000, "2026-02-01");
    b.incomes[0].vat = 2000;
    const l = taxLedger([a, b]);
    expect(l[0].vatCredit).toBe(30000);
    expect(l[1].vatCredit).toBe(10000);
    expect(l[1].vatDue).toBe(0);
  });
  it("brüt kira stopajını ikinci kez gider yazmaz, net kirayı brütleştirir", () => {
    const s = {
      ...defaults,
      rent: 3000000,
      fixedBasis: "30" as const,
      tax: { ...taxProfile("Şahıs"), rentWithholding: true },
    };
    const gross = newDay(s);
    expect(gross.taxCosts!.withholding).toBe(0);
    expect(gross.taxCosts!.withholdingCash).toBe(20000);
    expect(calculate(gross).total).toBe(100000);
    s.tax.rentIsNet = true;
    const net = newDay(s);
    expect(net.taxCosts!.withholding).toBe(25000);
    expect(calculate(net).total).toBe(125000);
  });
  it("aylık ek SGK ve Bağ-Kur günlük payı tek kez düşülür", () => {
    const d = newDay({
      ...defaults,
      fixedBasis: "30",
      tax: {
        ...taxProfile("Limited"),
        enabled: true,
        confirmed: true,
        monthlySgk: 300000,
        monthlyBagkur: 150000,
      },
    });
    expect(calculate(d).total).toBe(15000);
    expect(taxLedger([d])[0].before).toBe(-15000);
  });
  it("adi ortaklıkta ortak payları ve statüleri gerekir", () => {
    const d = sale(100000, "2026-01-01", "Adi Ortaklık");
    expect(taxLedger([d])[0].reserve).toBeNull();
    d.tax!.partners = [
      {
        name: "A",
        share: 5000,
        method: "progressive",
        openingBase: 0,
        corporateRate: 2500,
      },
      {
        name: "B",
        share: 5000,
        method: "corporate",
        openingBase: 0,
        corporateRate: 2500,
      },
    ];
    expect(taxLedger([d])[0].reserve).toBe(20000);
  });
  it("geçmiş gün vergi profilini yeni ayarlar etkilemez", () => {
    const d = sale(100000);
    const s = { ...defaults, tax: { ...d.tax!, corporateRate: 5000 } };
    expect(d.tax!.corporateRate).toBe(2500);
    const next = applySettingsToDay(d, s);
    expect(next.tax!.corporateRate).toBe(5000);
    expect(d.tax!.corporateRate).toBe(2500);
  });
  it("bozuk tarife ve %100 net stopajı reddeder", () => {
    const p = taxProfile("Şahıs");
    p.brackets[1].ceiling = 1;
    expect(taxSettingsSchema.safeParse(p).success).toBe(false);
    p.brackets = taxProfile("Şahıs").brackets;
    p.rentWithholding = true;
    p.rentIsNet = true;
    p.withholdingRate = 10000;
    expect(taxSettingsSchema.safeParse(p).success).toBe(false);
  });
});
it("devreden KDV ayı uyuşmazsa ödeme tahmini uydurmaz", () => {
  const d = sale(100000, "2026-10-01");
  d.tax!.openingVat = 1000;
  d.tax!.openingMonth = "2026-01";
  const r = taxLedger([d])[0];
  expect(r.vatDue).toBeNull();
  expect(r.reserve).toBe(15000);
});
it("yıl içinde vergi statüsü değişirse açılışları varsaymaz", () => {
  const a = sale(100000),
    b = sale(100000, "2026-01-02", "Limited");
  expect(taxLedger([a, b])[1].reserve).toBeNull();
});
