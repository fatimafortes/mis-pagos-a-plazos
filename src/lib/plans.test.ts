import { describe, expect, it } from "vitest";
import { sanitizePlan } from "./extraction";
import {
  applyEdit, confirmedPlanSchema, duplicateQuestion, emptyManualPlan, fieldSchemas, findDuplicate, formatField,
  isManualPlan, parseDraft, rowToSavedPlan, toConfirmedPlan,
} from "./plans";

const today = { y: 2026, m: 10, d: 16 };
const extracted = sanitizePlan(
  {
    provider_name: "PagaLuego", installment_amount: 412.5, payments_remaining: 4,
    due_day: 30, due_month: 10, due_year: null, frequency: null,
  },
  today,
);
const schema = confirmedPlanSchema(today);
const confirm = (p: typeof extracted) => toConfirmedPlan(p, p.field_sources, p.year_calculated);

describe("applyEdit: editing flips the tag to 'Tú me lo dijiste'", () => {
  it("a changed value becomes user", () => {
    const p = applyEdit(extracted, "installment_amount", 450);
    expect(p.installment_amount).toBe(450);
    expect(p.field_sources.installment_amount).toBe("user");
    expect(p.field_sources.payments_remaining).toBe("screenshot");
  });

  it("filling an unknown field becomes user", () => {
    const p = applyEdit(extracted, "frequency", "quincenal");
    expect(p.field_sources.frequency).toBe("user");
  });

  it("clearing a field becomes unknown", () => {
    expect(applyEdit(extracted, "payments_remaining", null).field_sources.payments_remaining).toBe("unknown");
  });

  it("an unchanged value keeps its source", () => {
    expect(applyEdit(extracted, "installment_amount", 412.5)).toBe(extracted);
  });

  it("editing the date drops the calculated-year flag", () => {
    expect(extracted.year_calculated).toBe(true);
    const p = applyEdit(extracted, "next_due_date", "2026-11-15");
    expect(p.year_calculated).toBe(false);
    expect(p.field_sources.next_due_date).toBe("user");
  });
});

describe("toConfirmedPlan + confirmedPlanSchema", () => {
  it("accepts a reviewed plan and records the calculated year", () => {
    const body = confirm(extracted);
    expect(body.field_sources.next_due_date_year).toBe("calculated");
    expect(schema.safeParse(body).success).toBe(true);
  });

  it("does not record a calculated year once the user typed the date", () => {
    const body = confirm(applyEdit(extracted, "next_due_date", "2026-11-15"));
    expect(body.field_sources).not.toHaveProperty("next_due_date_year");
    expect(schema.safeParse(body).success).toBe(true);
  });

  it("rejects out-of-range values on the server", () => {
    const bad = (patch: object) => schema.safeParse({ ...confirm(extracted), ...patch }).success;
    expect(bad({ installment_amount: -1 })).toBe(false);
    expect(bad({ installment_amount: 100000.01 })).toBe(false);
    expect(bad({ installment_amount: 1.005 })).toBe(false);
    expect(bad({ payments_remaining: 61 })).toBe(false);
    expect(bad({ payments_remaining: 2.5 })).toBe(false);
    expect(bad({ next_due_date: "2029-01-01" })).toBe(false);
    expect(bad({ next_due_date: "2026-02-30" })).toBe(false);
    expect(bad({ provider_name: "x".repeat(61) })).toBe(false);
    expect(bad({ frequency: "anual" })).toBe(false);
  });

  it("rejects a source that contradicts the value", () => {
    const body = confirm(extracted);
    expect(schema.safeParse({ ...body, field_sources: { ...body.field_sources, frequency: "user" } }).success).toBe(false);
    expect(schema.safeParse({ ...body, frequency: "mensual" }).success).toBe(false);
  });

  it("rejects unexpected keys such as user_id", () => {
    expect(schema.safeParse({ ...confirm(extracted), user_id: "someone-else" }).success).toBe(false);
    const body = confirm(extracted);
    expect(schema.safeParse({ ...body, field_sources: { ...body.field_sources, extra: "x" } }).success).toBe(false);
  });
});

describe("form helpers", () => {
  const fields = fieldSchemas(today);

  it("parses what the user types", () => {
    expect(parseDraft("installment_amount", " $1,412.50 ")).toBe(1412.5);
    expect(parseDraft("payments_remaining", "3")).toBe(3);
    expect(parseDraft("frequency", "")).toBeNull();
    expect(parseDraft("provider_name", "  CompraYa ")).toBe("CompraYa");
  });

  it("gives Spanish messages for bad input", () => {
    const r = fields.installment_amount.safeParse(parseDraft("installment_amount", "abc"));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/monto/i);
    const p = fields.payments_remaining.safeParse(61);
    if (!p.success) expect(p.error.issues[0].message).toBe("Máximo 60 pagos.");
  });

  it("formats values for the review card", () => {
    expect(formatField("installment_amount", 1412.5)).toBe("$1,412.50");
    expect(formatField("next_due_date", "2026-10-30")).toBe("30 oct 2026");
    expect(formatField("payments_remaining", 1)).toBe("1 pago");
    expect(formatField("frequency", null)).toBe("No aparece en la captura");
  });
});

describe("saved plans", () => {
  it("toConfirmedPlan marks SIMULADO plans", () => {
    const body = toConfirmedPlan(extracted, extracted.field_sources, false, true);
    expect(body.field_sources.simulated).toBe(true);
    expect(schema.safeParse(body).success).toBe(true);
    expect(toConfirmedPlan(extracted, extracted.field_sources, false).field_sources).not.toHaveProperty("simulated");
  });

  it("rowToSavedPlan converts numeric strings and reads the simulated mark", () => {
    const row = {
      id: "p1", provider_name: "PagaLuego", installment_amount: "412.50", payments_remaining: 4,
      next_due_date: null, frequency: "quincenal",
      field_sources: { ...extracted.field_sources, simulated: true as const },
    };
    expect(rowToSavedPlan(row)).toMatchObject({ installment_amount: 412.5, frequency: "quincenal", simulated: true });
    expect(rowToSavedPlan({ ...row, field_sources: extracted.field_sources }).simulated).toBe(false);
    expect(rowToSavedPlan({ ...row, installment_amount: null }).installment_amount).toBeNull();
  });
});

describe("Capturar a mano", () => {
  it("starts with every field unknown", () => {
    const p = emptyManualPlan();
    expect(Object.values(p.field_sources)).toEqual(Array(5).fill("unknown"));
    expect(isManualPlan(p.field_sources)).toBe(true);
  });

  it("everything typed is 'Tú me lo dijiste' and passes the same validation", () => {
    let p = emptyManualPlan();
    p = applyEdit(p, "provider_name", "MiTienda");
    p = applyEdit(p, "installment_amount", 412.5);
    p = applyEdit(p, "next_due_date", "2026-11-15");
    p = applyEdit(p, "frequency", "quincenal");
    expect(p.field_sources).toEqual({
      provider_name: "user", installment_amount: "user", payments_remaining: "unknown",
      next_due_date: "user", frequency: "user",
    });
    expect(isManualPlan(p.field_sources)).toBe(true);
    expect(schema.safeParse(confirm(p)).success).toBe(true);
  });

  it("an empty plan cannot be saved", () => {
    const r = schema.safeParse(confirm(emptyManualPlan()));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Captura al menos un dato del plan.");
  });

  it("a plan with any screenshot field is not manual", () => {
    expect(isManualPlan(extracted.field_sources)).toBe(false);
  });
});

describe("findDuplicate", () => {
  const saved = {
    id: "p1", provider_name: "PagaLuego", installment_amount: 412.5, payments_remaining: 4,
    next_due_date: "2026-10-30", frequency: "quincenal" as const,
  };
  const same = { ...saved, id: undefined, payments_remaining: 2 };

  it("matches same app, amount, next date and frequency (payments left may differ)", () => {
    expect(findDuplicate(same, [saved])).toBe(saved);
  });

  it("ignores case and spaces in the app name and compares amounts in centavos", () => {
    expect(findDuplicate({ ...same, provider_name: "  pagaluego " }, [saved])).toBe(saved);
    expect(findDuplicate({ ...same, installment_amount: 412.5000000001 }, [saved])).toBe(saved);
  });

  it("any difference in app, amount, date or frequency is a different plan", () => {
    expect(findDuplicate({ ...same, provider_name: "CompraYa" }, [saved])).toBeUndefined();
    expect(findDuplicate({ ...same, installment_amount: 412.51 }, [saved])).toBeUndefined();
    expect(findDuplicate({ ...same, next_due_date: "2026-11-15" }, [saved])).toBeUndefined();
    expect(findDuplicate({ ...same, frequency: "mensual" }, [saved])).toBeUndefined();
  });

  it("unknown values match unknown values", () => {
    const undated = { ...saved, next_due_date: null, frequency: null };
    expect(findDuplicate({ ...undated, id: undefined }, [undated])).toBe(undated);
  });

  it("asks with the app name", () => {
    expect(duplicateQuestion("PagaLuego")).toBe("Ya tienes un plan igual de PagaLuego. ¿Es otra compra o el mismo?");
    expect(duplicateQuestion(null)).toBe("Ya tienes un plan igual de esta app. ¿Es otra compra o el mismo?");
  });
});
