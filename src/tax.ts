import { calculate, type Day } from "./model";
import { splitVat, type TaxSettings } from "./tax-policy";
export {
  taxProfile,
  taxSettingsSchema,
  splitVat,
  type TaxSettings,
} from "./tax-policy";
export function progressiveTax(
  base: number,
  table: TaxSettings["brackets"],
): number {
  let previous = 0,
    total = 0;
  for (const bracket of table) {
    const part = Math.max(
      0,
      Math.min(Math.max(0, base), bracket.ceiling ?? Math.max(0, base)) -
        previous,
    );
    total += Math.round((part * bracket.rate) / 10000);
    if (bracket.ceiling === null || base <= bracket.ceiling) break;
    previous = bracket.ceiling;
  }
  return total;
}
export function taxOnBase(
  base: number,
  p: TaxSettings,
  method = p.method,
  custom = p.corporateRate,
): number {
  return method === "progressive"
    ? progressiveTax(Math.max(0, base), p.brackets)
    : Math.round((Math.max(0, base) * custom) / 10000);
}
export type TaxResult = {
  date: string;
  before: number | null;
  reserve: number | null;
  after: number | null;
  netRevenue: number | null;
  grossRevenue: number | null;
  outputVat: number | null;
  inputVat: number | null;
  vatDue: number | null;
  vatCredit: number | null;
  vatChange: number | null;
  taxableBase: number | null;
  paid: number;
  warnings: string[];
};
function localTax(d: Day) {
  const p = d.tax;
  const c = calculate(d);
  const warnings: string[] = [];
  if (!p?.enabled) warnings.push("Vergi hesabı etkin değil.");
  if (p && !p.confirmed)
    warnings.push("Vergi profili ve kümülatif açılış matrahı teyit edilmedi.");
  if (p && p.year !== Number(d.date.slice(0, 4)))
    warnings.push("Vergi yılı kayıt tarihiyle uyuşmuyor.");
  if (p?.method === "none")
    warnings.push("Bu şirket tipi için vergi yöntemi seçilmedi.");
  if (d.incomes.some((i) => i.mode === "net" && i.amount))
    warnings.push(
      "Net tahsilatın brüt faturası bilinmiyor; KDV ve vergi sonucu hesaplanamadı.",
    );
  if (
    p?.method === "partners" &&
    (!p.partners.length ||
      p.partners.reduce((a, x) => a + x.share, 0) !== 10000)
  )
    warnings.push("Ortakların statüleri ve toplam %100 payları gerekli.");
  if (warnings.length || !p) return { warnings };
  const revenues = d.incomes.map((i) =>
    splitVat(i.amount, i.vat ?? p.vatDefault, i.vatIncluded ?? p.vatIncluded),
  );
  const netRevenue = revenues.reduce((a, x) => a + x.net, 0),
    grossRevenue = revenues.reduce((a, x) => a + x.gross, 0),
    outputVat = revenues.reduce((a, x) => a + x.vat, 0);
  let inputVat = 0,
    expenseCost = 0;
  for (const e of d.expenses) {
    const vat = splitVat(e.amount, e.vat, e.vatIncluded ?? true);
    const eligible = e.invoice && e.vatDeductible === true;
    inputVat += eligible ? vat.vat : 0;
    expenseCost += eligible ? vat.net : vat.gross;
  }
  const withholding = d.taxCosts?.withholding ?? 0,
    contributions = d.taxCosts?.contributions ?? 0;
  const before =
    netRevenue -
    c.platform -
    c.pos -
    c.personnel -
    expenseCost -
    c.fixed -
    c.courier -
    c.other -
    withholding -
    contributions;
  // Fixed costs/commissions have no document-level deductible VAT data; kept at their entered gross cost.
  const adjustment = d.taxAdjustment ?? { additions: 0, deductions: 0 };
  return {
    warnings,
    netRevenue,
    grossRevenue,
    outputVat,
    inputVat,
    before,
    taxable: before + adjustment.additions - adjustment.deductions,
  };
}
/** Recomputed from chronological source records on every render. Editing a past date updates subsequent cumulative reserves. */
export function taxLedger(rawDays: Day[]): TaxResult[] {
  const days = [...rawDays].sort((a, b) => a.date.localeCompare(b.date));
  const yearState = new Map<
    string,
    {
      base: number;
      partnerBases: number[];
      blocked: boolean;
      method: string;
      partnerSignature: string;
    }
  >();
  const vatState = new Map<string, { balance: number; blocked: boolean }>();
  return days.map((d) => {
    const p = d.tax;
    const local = localTax(d);
    const out: TaxResult = {
      date: d.date,
      before: null,
      reserve: null,
      after: null,
      netRevenue: null,
      grossRevenue: null,
      outputVat: null,
      inputVat: null,
      vatDue: null,
      vatCredit: null,
      vatChange: null,
      taxableBase: null,
      paid: d.taxPaid ?? 0,
      warnings: [...local.warnings],
    };
    const year = d.date.slice(0, 4),
      month = d.date.slice(0, 7);
    let state = yearState.get(year);
    if (!state) {
      state = {
        method: p?.method ?? "none",
        partnerSignature: JSON.stringify(
          p?.partners.map((x) => [x.name, x.share, x.method]) ?? [],
        ),
        base: p?.openingBase ?? 0,
        partnerBases: p?.partners.map((x) => x.openingBase) ?? [],
        blocked: false,
      };
      yearState.set(year, state);
    }
    let vat = vatState.get(month);
    if (!vat) {
      const previousKey = [...vatState.keys()]
        .filter((m) => m < month)
        .sort()
        .at(-1);
      const previous = previousKey ? vatState.get(previousKey) : undefined;
      vat = {
        balance: previous
          ? Math.min(0, previous.balance)
          : -(p?.openingMonth === month ? p.openingVat : 0),
        blocked:
          (previous?.blocked ?? false) ||
          (!previous && !!p?.openingVat && p.openingMonth !== month),
      };
      vatState.set(month, vat);
    }
    if (!p || local.before === undefined) {
      state.blocked = true;
      vat.blocked = true;
      return out;
    }
    if (
      state.method !== p.method ||
      (p.method === "partners" &&
        state.partnerSignature !==
          JSON.stringify(p.partners.map((x) => [x.name, x.share, x.method])))
    ) {
      state.blocked = true;
      out.warnings.push(
        "Yıl içinde vergi statüsü veya ortak yapısı değişti; dönem açılışları ayrıca değerlendirilmelidir.",
      );
    }
    if (p.openingVat && vat.blocked && p.openingMonth !== month)
      out.warnings.push("Devreden KDV açılış ayı kayıtlı ilk ayla uyuşmuyor.");
    out.before = local.before;
    out.netRevenue = local.netRevenue!;
    out.grossRevenue = local.grossRevenue!;
    out.outputVat = local.outputVat!;
    out.inputVat = local.inputVat!;
    if (!state.blocked) {
      if (p.method === "partners") {
        if (state.partnerBases.length !== p.partners.length) {
          out.warnings.push(
            "Yıl içinde ortak yapısı değişti; dönem açılışları yeniden yapılandırılmalı.",
          );
          state.blocked = true;
        } else {
          let reserve = 0,
            allocated = 0;
          for (let i = 0; i < p.partners.length; i++) {
            const partner = p.partners[i],
              base = state.partnerBases[i];
            const share =
              i === p.partners.length - 1
                ? local.taxable! - allocated
                : Math.round((local.taxable! * partner.share) / 10000);
            allocated += share;
            const next = base + share;
            reserve +=
              taxOnBase(next, p, partner.method, partner.corporateRate) -
              taxOnBase(base, p, partner.method, partner.corporateRate);
            state.partnerBases[i] = next;
          }
          out.reserve = reserve;
        }
      } else {
        out.reserve =
          taxOnBase(state.base + local.taxable!, p) - taxOnBase(state.base, p);
      }
      state.base += local.taxable!;
      out.taxableBase = state.base;
    } else
      out.warnings.push(
        "Önceki günlerde eksik vergi bilgisi var; yıllık karşılık hesaplanamadı.",
      );
    if (!vat.blocked) {
      const prior = Math.max(0, vat.balance);
      vat.balance += local.outputVat! - local.inputVat!;
      out.vatDue = Math.max(0, vat.balance);
      out.vatCredit = Math.max(0, -vat.balance);
      out.vatChange = Math.max(0, vat.balance) - prior;
    } else
      out.warnings.push(
        "Önceki kayıtlarda eksik KDV bilgisi var; devreden KDV hesaplanamadı.",
      );
    if (out.reserve !== null) out.after = local.before - out.reserve;
    return out;
  });
}
export function taxTotals(ledger: TaxResult[], from = "", to = "") {
  const rows = ledger.filter(
    (x) => (!from || x.date >= from) && (!to || x.date <= to),
  );
  const total = (key: "before" | "after" | "reserve" | "vatChange") =>
    rows.length && rows.every((r) => r[key] !== null)
      ? rows.reduce((a, r) => a + (r[key] ?? 0), 0)
      : null;
  return {
    before: total("before"),
    after: total("after"),
    reserve: total("reserve"),
    vat: total("vatChange"),
    paid: rows.reduce((a, r) => a + r.paid, 0),
    count: rows.length,
  };
}
