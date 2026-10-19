import { z } from "zod";
import rules from "./tax-rules.json";
const amount = z.number().int().min(0).max(100_000_000_000);
const signed = z.number().int().min(-100_000_000_000).max(100_000_000_000);
const rate = z.number().int().min(0).max(10000);
export const bracketSchema = z.object({ ceiling: amount.nullable(), rate });
const brackets = z
  .array(bracketSchema)
  .min(1)
  .max(20)
  .refine(
    (bs) =>
      bs[bs.length - 1].ceiling === null &&
      bs.every(
        (b, i) =>
          i === bs.length - 1 ||
          (b.ceiling !== null &&
            (i === 0 || b.ceiling! > (bs[i - 1].ceiling ?? 0))),
      ),
    "Dilimler artan sırada olmalı, son dilim sınırsız olmalı",
  );
export const taxSettingsSchema = z
  .object({
    enabled: z.boolean(),
    confirmed: z.boolean(),
    year: z.number().int().min(2020).max(2100),
    version: z.string().min(1).max(100),
    method: z.enum(["progressive", "corporate", "partners", "none"]),
    corporateRate: rate,
    brackets,
    vatDefault: rate,
    vatIncluded: z.boolean(),
    openingBase: signed,
    openingVat: amount,
    openingMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    monthlySgk: amount,
    monthlyBagkur: amount,
    rentWithholding: z.boolean(),
    withholdingRate: rate,
    rentIsNet: z.boolean(),
    partners: z
      .array(
        z.object({
          name: z.string().min(1).max(100),
          share: rate,
          method: z.enum(["progressive", "corporate"]),
          openingBase: signed,
          corporateRate: rate,
        }),
      )
      .max(20),
  })
  .refine(
    (p) => !(p.rentWithholding && p.rentIsNet && p.withholdingRate === 10000),
    "Net kira stopajı %100 olamaz",
  );
export type TaxSettings = z.infer<typeof taxSettingsSchema>;
export function taxProfile(company: string): TaxSettings {
  return {
    enabled: false,
    confirmed: false,
    year: rules.year,
    version: rules.id,
    method:
      company === "Limited" || company === "Anonim"
        ? "corporate"
        : company === "Şahıs"
          ? "progressive"
          : company === "Adi Ortaklık"
            ? "partners"
            : "none",
    corporateRate: rules.corporateRate,
    brackets: structuredClone(rules.brackets),
    vatDefault: 1000,
    vatIncluded: true,
    openingBase: 0,
    openingVat: 0,
    openingMonth: "2026-01",
    monthlySgk: 0,
    monthlyBagkur: 0,
    rentWithholding: false,
    withholdingRate: 2000,
    rentIsNet: false,
    partners: [],
  };
}
export function splitVat(value: number, rate: number, included: boolean) {
  const net = included ? Math.round((value * 10000) / (10000 + rate)) : value;
  const vat = included ? value - net : Math.round((value * rate) / 10000);
  return { net, vat, gross: net + vat };
}
