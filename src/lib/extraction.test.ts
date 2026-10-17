import { describe, expect, it, vi } from "vitest";
import { parseModelOutput, runExtraction, sanitizePlan, simulatedModelText, todayInMexico } from "./extraction";

const today = { y: 2026, m: 10, d: 16 };
const good = {
  provider_name: "PagaLuego",
  installment_amount: 412.5,
  payments_remaining: 4,
  next_due_date: "2026-10-30",
  frequency: "quincenal",
};
const reply = (plans: unknown[], is_payment_screen = true) => JSON.stringify({ is_payment_screen, plans });

describe("parseModelOutput", () => {
  it("accepts schema-valid output and labels every field from the screenshot", () => {
    const r = parseModelOutput(reply([good]), today);
    expect(r.kind).toBe("plans");
    if (r.kind !== "plans") return;
    expect(r.simulated).toBe(false);
    expect(r.plans[0]).toMatchObject(good);
    expect(Object.values(r.plans[0].field_sources)).toEqual(Array(5).fill("screenshot"));
  });

  it("keeps nulls as unknown, never filling them in", () => {
    const r = parseModelOutput(reply([{ ...good, next_due_date: null, frequency: null }]), today);
    if (r.kind !== "plans") throw new Error(r.kind);
    expect(r.plans[0].next_due_date).toBeNull();
    expect(r.plans[0].field_sources.next_due_date).toBe("unknown");
    expect(r.plans[0].field_sources.frequency).toBe("unknown");
    expect(r.plans[0].field_sources.installment_amount).toBe("screenshot");
  });

  it("rejects text that is not JSON", () => {
    expect(parseModelOutput("Claro, aquí está: {", today)).toEqual({ kind: "invalid_output" });
  });

  it("rejects JSON with the wrong shape", () => {
    expect(parseModelOutput(JSON.stringify({ plans: [good] }), today).kind).toBe("invalid_output");
    expect(parseModelOutput(JSON.stringify({ is_payment_screen: "yes", plans: [] }), today).kind).toBe("invalid_output");
    expect(parseModelOutput(JSON.stringify({ is_payment_screen: true, plans: {} }), today).kind).toBe("invalid_output");
    expect(parseModelOutput(reply([{ provider_name: "X" }]), today).kind).toBe("invalid_output");
  });

  it("rejects more than 10 plans", () => {
    expect(parseModelOutput(reply(Array(11).fill(good)), today).kind).toBe("invalid_output");
  });

  it("gives a friendly rejection for a non-payment screen", () => {
    const r = parseModelOutput(reply([], false), today);
    expect(r.kind).toBe("rejected");
    if (r.kind === "rejected") expect(r.message).toMatch(/No veo pagos a plazos/);
  });

  it("rejects a payment screen with no plans", () => {
    expect(parseModelOutput(reply([]), today).kind).toBe("rejected");
  });
});

describe("sanitizePlan: out-of-range values become null", () => {
  const check = (patch: Record<string, unknown>) => sanitizePlan({ ...good, ...patch }, today);

  it("amount outside 0–100,000 or not a number", () => {
    expect(check({ installment_amount: -1 }).installment_amount).toBeNull();
    expect(check({ installment_amount: 100000.01 }).installment_amount).toBeNull();
    expect(check({ installment_amount: "412.50" }).installment_amount).toBeNull();
    expect(check({ installment_amount: Number.NaN }).installment_amount).toBeNull();
    expect(check({ installment_amount: 1412.5 }).installment_amount).toBe(1412.5);
    expect(check({ installment_amount: 0 }).installment_amount).toBe(0);
  });

  it("payments outside 0–60 or not an integer", () => {
    expect(check({ payments_remaining: 61 }).payments_remaining).toBeNull();
    expect(check({ payments_remaining: -1 }).payments_remaining).toBeNull();
    expect(check({ payments_remaining: 2.5 }).payments_remaining).toBeNull();
    expect(check({ payments_remaining: 60 }).payments_remaining).toBe(60);
  });

  it("dates that are invalid or more than 2 years away", () => {
    expect(check({ next_due_date: "2026-02-30" }).next_due_date).toBeNull();
    expect(check({ next_due_date: "30/10/2026" }).next_due_date).toBeNull();
    expect(check({ next_due_date: "2028-10-17" }).next_due_date).toBeNull();
    expect(check({ next_due_date: "2024-10-15" }).next_due_date).toBeNull();
    expect(check({ next_due_date: "2028-10-16" }).next_due_date).toBe("2028-10-16");
  });

  it("provider names that are empty or over 60 chars", () => {
    expect(check({ provider_name: "   " }).provider_name).toBeNull();
    expect(check({ provider_name: "x".repeat(61) }).provider_name).toBeNull();
    expect(check({ provider_name: "  CompraYa " }).provider_name).toBe("CompraYa");
  });

  it("unknown frequencies", () => {
    expect(check({ frequency: "anual" }).frequency).toBeNull();
    expect(check({ frequency: "Quincenal" }).frequency).toBeNull();
    expect(check({ frequency: "mensual" }).frequency).toBe("mensual");
  });

  it("marks sanitized fields as unknown", () => {
    expect(check({ installment_amount: -5 }).field_sources.installment_amount).toBe("unknown");
  });
});

describe("runExtraction", () => {
  const bytes = new Uint8Array([1, 2, 3]);

  it("SIMULATE_AI returns the canned extraction without calling the model", async () => {
    const callModel = vi.fn();
    const r = await runExtraction({ bytes, mimeType: "image/png", today, simulate: true, callModel });
    expect(callModel).not.toHaveBeenCalled();
    expect(r.kind).toBe("plans");
    if (r.kind !== "plans") return;
    expect(r.simulated).toBe(true);
    expect(r.plans.map((p) => p.provider_name)).toEqual(["PagaLuego", "CompraYa"]);
    expect(r.plans[0].field_sources.next_due_date).toBe("unknown");
  });

  it("falls back to the simulated extraction when the API fails", async () => {
    const onModelError = vi.fn();
    const r = await runExtraction({
      bytes, mimeType: "image/png", today, simulate: false,
      callModel: () => Promise.reject(new Error("429 quota")), onModelError,
    });
    expect(onModelError).toHaveBeenCalledOnce();
    expect(r.kind === "plans" && r.simulated).toBe(true);
  });

  it("passes real model output through validation, not simulated", async () => {
    const r = await runExtraction({
      bytes, mimeType: "image/jpeg", today, simulate: false, callModel: async () => reply([good]),
    });
    expect(r.kind === "plans" && r.simulated).toBe(false);
  });

  it("reports bad model output instead of simulating", async () => {
    const r = await runExtraction({
      bytes, mimeType: "image/png", today, simulate: false, callModel: async () => "no json",
    });
    expect(r.kind).toBe("invalid_output");
  });
});

describe("simulated data and today", () => {
  it("canned dated plan always falls in the next quincena", () => {
    const at = (y: number, m: number, d: number) => JSON.parse(simulatedModelText({ y, m, d })).plans[1].next_due_date;
    expect(at(2026, 10, 15)).toBe("2026-10-16");
    expect(at(2026, 10, 16)).toBe("2026-11-01");
    expect(at(2026, 12, 31)).toBe("2027-01-01");
  });

  it("uses the Mexico City date, not UTC", () => {
    // 2026-10-17 03:00 UTC is still 2026-10-16 in Mexico City (UTC-6).
    expect(todayInMexico(new Date("2026-10-17T03:00:00Z"))).toEqual({ y: 2026, m: 10, d: 16 });
  });
});
