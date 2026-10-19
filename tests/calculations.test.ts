import { describe, it, expect } from "vitest";
import {
  defaults,
  newDay,
  calculate,
  parseMoney,
  rangeDays,
  summarize,
  daySchema,
} from "../src/model";
describe("Kuruş bazlı hesap motoru", () => {
  it("gelir, gider, platform ve POS komisyonunu bir kez hesaplar", () => {
    const d = newDay(defaults, "2026-10-19");
    d.incomes[0].amount = 100000;
    d.incomes[0].rate = 1800;
    d.pos[0].amount = 50000;
    d.pos[0].rate = 200;
    d.expenses = [
      {
        id: "1",
        description: "Ekmek",
        category: "Malzeme",
        amount: 2000,
        invoice: false,
        vat: 0,
        date: d.date,
      },
    ];
    const c = calculate(d);
    expect(c.gross).toBe(100000);
    expect(c.platform).toBe(18000);
    expect(c.pos).toBe(1000);
    expect(c.result).toBe(79000);
  });
  it("net tahsilatta platform komisyonunu tekrar düşmez", () => {
    const d = newDay(defaults);
    d.incomes[0] = { ...d.incomes[0], amount: 82000, rate: 1800, mode: "net" };
    expect(calculate(d).platform).toBe(0);
    expect(calculate(d).result).toBe(82000);
  });
  it("POS tahsilatı satış toplamını aşamaz", () => {
    const d = newDay(defaults);
    d.pos[0].amount = 1;
    expect(() => calculate(d)).toThrow("POS");
  });
  it("aylık gideri gerçek ay gününe böler; artık yıl dahil", () => {
    const s = { ...defaults, rent: 290000 };
    expect(newDay(s, "2024-02-10").fixed).toBe(10000);
    expect(newDay(s, "2026-02-10").fixed).toBe(10357);
    expect(newDay(s, "2026-10-10").fixed).toBe(9355);
  });
  it("personel, prim, sigorta ve diğer maliyeti toplar; avansı gider saymaz", () => {
    const d = newDay(defaults);
    d.employees = [
      {
        id: "1",
        name: "Elif",
        wage: 10000,
        bonus: 1500,
        insurance: 2000,
        other: 500,
        payment: 20000,
      },
    ];
    expect(calculate(d).personnel).toBe(14000);
    expect(calculate(d).total).toBe(14000);
    expect(calculate(d).payments).toBe(20000);
  });
  it("fişsiz gideri sayar; KDV indirimi varsaymaz", () => {
    const d = newDay(defaults);
    d.expenses = [
      {
        id: "1",
        description: "Gider",
        amount: 12000,
        category: "Diğer",
        invoice: false,
        vat: 2000,
        date: d.date,
      },
    ];
    expect(calculate(d).expenses).toBe(12000);
  });
  it("kurye ve diğer kesintileri hesaplar", () => {
    const d = newDay(defaults);
    d.incomes[0].amount = 100000;
    d.courierRate = 1000;
    d.otherRate = 100;
    expect(calculate(d).courier).toBe(10000);
    expect(calculate(d).other).toBe(1000);
  });
  it("tarih aralığını iki uç dahil süzer ve sonucu toplar", () => {
    const days = ["2026-10-01", "2026-10-02", "2026-10-03"].map((date) => {
      const d = newDay(defaults, date);
      d.incomes[0].amount = 10000;
      return d;
    });
    const found = rangeDays(days, "2026-10-02", "2026-10-03");
    expect(found).toHaveLength(2);
    expect(summarize(found).result).toBe(20000);
  });
  it("Türkçe tutarları kuruş olarak ayrıştırır ve hassasiyeti korur", () => {
    expect(parseMoney("2.749,45")).toBe(274945);
    expect(parseMoney("0,29")).toBe(29);
    expect(parseMoney("1250.50")).toBe(125050);
    expect(() => parseMoney("-1")).toThrow();
    expect(() => parseMoney("1,001")).toThrow();
  });
  it("geçersiz tarih, oran ve negatif tutarı reddeder", () => {
    const d = newDay(defaults);
    expect(daySchema.safeParse({ ...d, date: "2026-02-30" }).success).toBe(
      false,
    );
    d.incomes[0].rate = 10001;
    expect(() => calculate(d)).toThrow();
    d.incomes[0].rate = 0;
    d.incomes[0].amount = -1;
    expect(() => calculate(d)).toThrow();
  });
  it("ayar değişiklikleri geçmiş günün anlık görüntüsünü değiştirmez", () => {
    const s = structuredClone(defaults);
    s.rent = 310000;
    const d = newDay(s, "2026-10-01");
    s.rent = 620000;
    s.channels[0].rate = 2000;
    expect(d.fixed).toBe(10000);
    expect(d.incomes[0].rate).toBe(0);
  });
  it("zararlı günleri ve kârlı günleri ayrı özetler", () => {
    const a = newDay(defaults, "2026-10-01"),
      b = newDay(defaults, "2026-10-02");
    a.incomes[0].amount = 10000;
    b.fixed = 3000;
    expect(summarize([a, b])).toEqual({
      gross: 10000,
      total: 3000,
      result: 7000,
      profit: 10000,
      loss: 3000,
    });
  });
});
