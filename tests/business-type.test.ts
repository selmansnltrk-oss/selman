import { it, expect } from "vitest";
import {
  defaults,
  newDay,
  visibleIncomes,
  applySettingsToDay,
  calculate,
  daySchema,
} from "../src/model";
it("food businesses show food platforms, other types retain general and POS", () => {
  for (const type of ["Restoran / Kafe", "Kafe / Restoran"]) {
    expect(newDay({ ...defaults, type }).incomes.map((i) => i.id)).toContain(
      "yemek",
    );
  }
  const d = newDay({ ...defaults, type: "Market" });
  expect(d.incomes.map((i) => i.id)).toEqual(["store"]);
  expect(d.pos.length).toBeGreaterThan(0);
});
it("type changes preserve saved snapshots, amounts, totals and legacy data", () => {
  const original = newDay(defaults, "2026-10-01");
  original.incomes[0].amount = 100000;
  const before = structuredClone(original),
    total = calculate(original);
  const general = { ...defaults, type: "Market" };
  const updated = applySettingsToDay(original, general);
  expect(original).toEqual(before);
  expect(visibleIncomes(updated).map((i) => i.id)).toContain("yemek");
  expect(updated.businessType).toBe(original.businessType);
  expect(calculate(updated).gross).toBe(total.gross);
  const legacy = { ...original, businessType: undefined };
  expect(daySchema.parse(legacy)).toBeDefined();
  expect(visibleIncomes(legacy)).toEqual(original.incomes);
  const draft = { ...updated, businessType: "Market" };
  expect(visibleIncomes(draft).map((i) => i.id)).toContain("yemek"); // Nonzero never hidden.
  expect(visibleIncomes(draft).map((i) => i.id)).not.toContain("getir");
});
