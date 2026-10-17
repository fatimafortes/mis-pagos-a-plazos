import { describe, expect, it } from "vitest";
import { buildSchedule, formatPesos, parseDate, paymentQuincenas, quincenaIndex, quincenaLabel, toCentavos, type PlanInput } from "./quincenas";

const d = (s: string) => parseDate(s)!;

describe("quincena boundaries", () => {
  it("day 15 is the first quincena, day 16 the second", () => {
    expect(quincenaIndex(d("2026-11-15")) + 1).toBe(quincenaIndex(d("2026-11-16")));
  });
  it("labels use the real month end", () => {
    expect(quincenaLabel(quincenaIndex(d("2026-11-20")))).toBe("16–30 nov");
    expect(quincenaLabel(quincenaIndex(d("2027-02-20")))).toBe("16–28 feb");
    expect(quincenaLabel(quincenaIndex(d("2028-02-20")))).toBe("16–29 feb");
    expect(quincenaLabel(quincenaIndex(d("2026-12-01")))).toBe("1–15 dic");
  });
  it("rejects impossible dates", () => {
    expect(parseDate("2026-02-30")).toBeNull();
    expect(parseDate("30/11/2026")).toBeNull();
  });
});

describe("payment sequences", () => {
  it("quincenal: one payment in each following quincena, across the year end", () => {
    const qs = paymentQuincenas(d("2026-12-20"), "quincenal", 3);
    expect(qs.map(quincenaLabel)).toEqual(["16–31 dic", "1–15 ene", "16–31 ene"]);
  });
  it("mensual clamps Jan 31 to Feb month end", () => {
    const qs = paymentQuincenas(d("2027-01-31"), "mensual", 3);
    expect(qs.map(quincenaLabel)).toEqual(["16–31 ene", "16–28 feb", "16–31 mar"]);
  });
  it("semanal adds 7 days", () => {
    const qs = paymentQuincenas(d("2026-11-10"), "semanal", 3); // 10, 17, 24
    expect(qs.map(quincenaLabel)).toEqual(["1–15 nov", "16–30 nov", "16–30 nov"]);
  });
});

describe("money", () => {
  it("sums in centavos without float drift", () => {
    expect(toCentavos(0.1) + toCentavos(0.2)).toBe(30);
    expect(formatPesos(165000)).toBe("$1,650.00");
  });
});

describe("buildSchedule", () => {
  const today = d("2026-10-16");
  const compraYa: PlanInput = { provider_name: "CompraYa", installment_amount: 350, payments_remaining: 3, next_due_date: "2026-11-05", frequency: "quincenal" };
  const pagaLuego: PlanInput = { provider_name: "PagaLuego", installment_amount: 412.5, payments_remaining: 4, next_due_date: null, frequency: "quincenal" };

  it("matches the mockup: CompraYa in three quincenas, PagaLuego without date", () => {
    const s = buildSchedule([compraYa, pagaLuego], today);
    expect(s.rows.map((r) => [r.label, r.totalCentavos])).toEqual([
      ["16–31 oct", 0], ["1–15 nov", 35000], ["16–30 nov", 35000], ["1–15 dic", 35000], ["16–31 dic", 0], ["1–15 ene", 0],
    ]);
    expect(s.undated).toEqual([{ provider: "PagaLuego", missing: ["la próxima fecha"], totalCentavos: 165000, payments: 4 }]);
  });

  it("the friend's case: quincenal payments count twice a month", () => {
    const plans: PlanInput[] = [
      { provider_name: "Amazon", installment_amount: 500, payments_remaining: 3, next_due_date: "2026-11-01", frequency: "mensual" },
      { provider_name: "Mercado Pago", installment_amount: 400, payments_remaining: 3, next_due_date: "2026-11-01", frequency: "quincenal" },
      { provider_name: "Aplazo", installment_amount: 600, payments_remaining: 2, next_due_date: "2026-11-01", frequency: "quincenal" },
    ];
    const s = buildSchedule(plans, today);
    const november = s.rows[1].totalCentavos + s.rows[2].totalCentavos;
    expect(november).toBe(250000); // MX$2,500, not the MX$1,500 he estimated
  });

  it("unknown amount gives an unknown total, never zero", () => {
    const s = buildSchedule([{ ...compraYa, installment_amount: null }], today);
    expect(s.undated[0].totalCentavos).toBeNull();
    expect(s.rows.every((r) => r.totalCentavos === 0)).toBe(true);
  });

  it("past and beyond-horizon payments are reported, not dropped", () => {
    const s = buildSchedule([{ ...compraYa, next_due_date: "2026-10-01", payments_remaining: 10 }], today);
    expect(s.beforeCentavos).toBe(35000);
    expect(s.afterCentavos).toBe(35000 * 3);
  });
});

describe("simulated plans", () => {
  const today = d("2026-10-16");
  const real: PlanInput = { provider_name: "CompraYa", installment_amount: 350, payments_remaining: 1, next_due_date: "2026-11-05", frequency: "quincenal" };

  it("keep simulated amounts on their own line, still counted in the total", () => {
    const s = buildSchedule([real, { ...real, installment_amount: 100, simulated: true }], today);
    expect(s.rows[1].totalCentavos).toBe(45000);
    expect(s.rows[1].items).toEqual([
      { key: "#0", provider: "CompraYa", centavos: 35000 },
      { key: "#1", provider: "CompraYa", centavos: 10000, simulated: true },
    ]);
  });

  it("carry id and simulated into Sin fecha", () => {
    const s = buildSchedule([{ ...real, id: "p1", next_due_date: null, simulated: true }], today);
    expect(s.undated[0]).toMatchObject({ id: "p1", simulated: true });
  });
});

describe("one line per saved plan", () => {
  const today = d("2026-10-16");
  const plan: PlanInput = { provider_name: "PagaLuego", installment_amount: 412.5, payments_remaining: 1, next_due_date: "2026-11-05", frequency: "quincenal" };

  it("two plans with the same app name stay on separate lines", () => {
    const s = buildSchedule([{ ...plan, id: "p1" }, { ...plan, id: "p2", installment_amount: 200 }], today);
    expect(s.rows[1].items).toEqual([
      { key: "p1", provider: "PagaLuego", centavos: 41250 },
      { key: "p2", provider: "PagaLuego", centavos: 20000 },
    ]);
    expect(s.rows[1].totalCentavos).toBe(61250);
  });

  it("two weekly payments of the same plan in one quincena share its line", () => {
    const s = buildSchedule([{ ...plan, id: "p1", frequency: "semanal", payments_remaining: 2, next_due_date: "2026-11-01" }], today);
    expect(s.rows[1].items).toEqual([{ key: "p1", provider: "PagaLuego", centavos: 82500 }]);
  });

  it("keeps exact centavos: $412.50 is 41250, never rounded to pesos", () => {
    const s = buildSchedule([{ ...plan, id: "p1" }], today);
    expect(s.rows[1].totalCentavos).toBe(41250);
    expect(formatPesos(s.rows[1].totalCentavos)).toBe("$412.50");
  });
});
