import { z } from "zod";
const cents = z.number().int().min(0).max(100_000_000_000);
const rate = z.number().int().min(0).max(10000);
const id = z.string().min(1).max(100);
const text = z.string().trim().min(1).max(200);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + "T12:00:00Z");
    return !isNaN(+d) && d.toISOString().slice(0, 10) === s;
  }, "Geçersiz tarih");
export const channelSchema = z.object({ id, name: text, rate });
export const employeeSchema = z.object({
  id,
  name: text,
  wage: cents,
  bonus: cents,
  insurance: cents,
  other: cents,
  payment: cents,
});
export const settingsSchema = z.object({
  name: text,
  type: z.string().max(100),
  company: z.string().max(100),
  address: z.string().max(500),
  rent: cents,
  accounting: cents,
  fixed: cents,
  channels: z.array(channelSchema).max(50),
  pos: z.array(channelSchema).max(20),
  courierModel: z.string().max(100),
  courierRate: rate,
  otherRate: rate,
  employees: z.array(employeeSchema).max(100),
});
export const daySchema = z.object({
  date: dateSchema,
  incomes: z
    .array(
      z.object({
        id,
        name: text,
        amount: cents,
        rate,
        mode: z.enum(["gross", "net"]),
      }),
    )
    .max(100),
  pos: z.array(z.object({ id, name: text, amount: cents, rate })).max(20),
  employees: z.array(employeeSchema).max(100),
  expenses: z
    .array(
      z.object({
        id,
        description: text,
        amount: cents,
        category: text,
        invoice: z.boolean(),
        vat: rate,
        date: dateSchema,
      }),
    )
    .max(500),
  fixed: cents,
  courierRate: rate,
  otherRate: rate,
  note: z.string().max(2000),
});
export type Settings = z.infer<typeof settingsSchema>;
export type Day = z.infer<typeof daySchema>;
export type Employee = z.infer<typeof employeeSchema>;
export const uid = () => crypto.randomUUID();
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const money = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(n / 100);
export const humanDate = (s: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(s + "T12:00:00"));
export function parseMoney(s: string): number {
  const v = s.trim().replace(/\s/g, "");
  if (!v) return 0;
  const normalized = v.includes(",")
    ? v.replace(/\./g, "").replace(",", ".")
    : v;
  if (!/^\d+(\.\d{0,2})?$/.test(normalized))
    throw Error("Tutarı 1.250,50 veya 1250.50 biçiminde girin.");
  const [a, b = ""] = normalized.split(".");
  const n = Number(a) * 100 + Number(b.padEnd(2, "0"));
  return cents.parse(n);
}
export const defaults: Settings = {
  name: "İşletmem",
  type: "Restoran / Kafe",
  company: "Şahıs",
  address: "",
  rent: 0,
  accounting: 0,
  fixed: 0,
  channels: [
    { id: "yemek", name: "Yemeksepeti", rate: 0 },
    { id: "getir", name: "Getir", rate: 0 },
    { id: "uber", name: "Uber", rate: 0 },
    { id: "migros", name: "Migros", rate: 0 },
    { id: "store", name: "Mağaza içi satış", rate: 0 },
  ],
  pos: [{ id: "pos", name: "POS cihazı", rate: 0 }],
  courierModel: "Yok",
  courierRate: 0,
  otherRate: 0,
  employees: [],
};
export function newDay(s: Settings, date = today()): Day {
  const [y, m] = date.split("-").map(Number);
  return {
    date,
    incomes: s.channels.map((c) => ({ ...c, amount: 0, mode: "gross" })),
    pos: s.pos.map((p) => ({ ...p, amount: 0 })),
    employees: s.employees.map((e) => ({ ...e, payment: 0 })),
    expenses: [],
    fixed: Math.round(
      (s.rent + s.accounting + s.fixed) / new Date(y, m, 0).getDate(),
    ),
    courierRate: s.courierRate,
    otherRate: s.otherRate,
    note: "",
  };
}
export function calculate(raw: Day) {
  const d = daySchema.parse(raw);
  const gross = d.incomes.reduce((a, i) => a + i.amount, 0);
  const platform = d.incomes.reduce(
    (a, i) =>
      a + (i.mode === "gross" ? Math.round((i.amount * i.rate) / 10000) : 0),
    0,
  );
  const posBase = d.pos.reduce((a, p) => a + p.amount, 0);
  if (posBase > gross)
    throw Error(
      "POS tahsilat toplamı, girilen satış toplamını aşamaz. POS tutarı satışlara ayrıca eklenmez.",
    );
  const pos = d.pos.reduce(
    (a, p) => a + Math.round((p.amount * p.rate) / 10000),
    0,
  );
  const personnel = d.employees.reduce(
    (a, e) => a + e.wage + e.bonus + e.insurance + e.other,
    0,
  );
  const payments = d.employees.reduce((a, e) => a + e.payment, 0);
  const expenses = d.expenses.reduce((a, e) => a + e.amount, 0);
  const courier = Math.round((gross * d.courierRate) / 10000);
  const other = Math.round((gross * d.otherRate) / 10000);
  const total =
    platform + pos + personnel + expenses + d.fixed + courier + other;
  return {
    gross,
    platform,
    pos,
    personnel,
    payments,
    expenses,
    fixed: d.fixed,
    courier,
    other,
    total,
    result: gross - total,
    hasNet: d.incomes.some((i) => i.mode === "net" && i.amount > 0),
  };
}
export function rangeDays(days: Day[], from: string, to: string) {
  return days
    .filter((d) => (!from || d.date >= from) && (!to || d.date <= to))
    .sort((a, b) => b.date.localeCompare(a.date));
}
export function summarize(days: Day[]) {
  return days.reduce(
    (a, d) => {
      const c = calculate(d);
      return {
        gross: a.gross + c.gross,
        total: a.total + c.total,
        result: a.result + c.result,
        profit: a.profit + Math.max(0, c.result),
        loss: a.loss + Math.max(0, -c.result),
      };
    },
    { gross: 0, total: 0, result: 0, profit: 0, loss: 0 },
  );
}
