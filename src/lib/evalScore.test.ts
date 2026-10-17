import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseModelOutput } from "./extraction";
import { classifyServiceError, scoreFixture, summarize, type ExpectedFixture } from "./evalScore";

const today = { y: 2026, m: 10, d: 16 };
const expected: ExpectedFixture = {
  case: "test",
  is_payment_screen: true,
  plans: [{
    provider_name: "PagaLuego", installment_amount: 412.5, payments_remaining: 4,
    next_due_date: null, frequency: "quincenal", year_calculated: false,
  }],
};
const model = (plans: object[], is_payment_screen = true) =>
  parseModelOutput(JSON.stringify({ is_payment_screen, plans }), today);
const raw = {
  provider_name: "PagaLuego", installment_amount: 412.5, payments_remaining: 4,
  due_day: null, due_month: null, due_year: null, frequency: "quincenal",
};

describe("scoreFixture", () => {
  it("all fields right, including a correct null", () => {
    const s = scoreFixture("a", expected, model([raw]));
    expect(s).toMatchObject({ screenOk: true, fieldsCorrect: 5, fieldsTotal: 5, invented: [], wrong: [] });
  });

  it("a value where the screenshot shows none is invented", () => {
    const s = scoreFixture("a", expected, model([{ ...raw, due_day: 30, due_month: 10, due_year: 2026 }]));
    expect(s.invented).toEqual(['plan 1 · next_due_date: "2026-10-30" (no se ve)']);
    expect(s.fieldsCorrect).toBe(4);
  });

  it("a missed or misread value is wrong, not invented", () => {
    const s = scoreFixture("a", expected, model([{ ...raw, installment_amount: 413, provider_name: null }]));
    expect(s.invented).toEqual([]);
    expect(s.wrong).toHaveLength(2);
  });

  it("compares amounts in centavos", () => {
    const s = scoreFixture("a", { ...expected, plans: [{ ...expected.plans[0], installment_amount: 12345.67 }] },
      model([{ ...raw, installment_amount: 12345.670000001 }]));
    expect(s.fieldsCorrect).toBe(5);
  });

  it("a date is wrong if the year was calculated but should have been read", () => {
    const exp = { ...expected, plans: [{ ...expected.plans[0], next_due_date: "2027-01-05", year_calculated: false }] };
    const s = scoreFixture("a", exp, model([{ ...raw, due_day: 5, due_month: 1, due_year: null }]));
    expect(s.wrong).toHaveLength(1);
  });

  it("extra plans count as invented", () => {
    const s = scoreFixture("a", expected, model([raw, { ...raw, provider_name: "Fantasma" }]));
    expect(s.invented.length).toBe(4);
  });

  it("a rejected payment screen loses every field but invents nothing", () => {
    const s = scoreFixture("a", expected, model([], false));
    expect(s).toMatchObject({ screenOk: false, fieldsCorrect: 0, fieldsTotal: 5, invented: [] });
  });

  it("a non-payment screen must be rejected", () => {
    const chat: ExpectedFixture = { case: "chat", is_payment_screen: false, plans: [] };
    expect(scoreFixture("c", chat, model([], false)).screenOk).toBe(true);
    const s = scoreFixture("c", chat, model([raw]));
    expect(s.screenOk).toBe(false);
    expect(s.invented.length).toBe(4);
  });
});

describe("summarize", () => {
  it("passes only with ≥95% accuracy, 0 invented values and every screen right", () => {
    const good = scoreFixture("a", expected, model([raw]));
    expect(summarize([good, good]).passed).toBe(true);
    const bad = scoreFixture("b", expected, model([{ ...raw, due_day: 1, due_month: 11, due_year: 2026 }]));
    expect(summarize(Array(30).fill(good).concat(bad))).toMatchObject({ invented: 1, passed: false });
  });
});

describe("tests/fixtures/expected.json", () => {
  const file = JSON.parse(readFileSync(new URL("../../tests/fixtures/expected.json", import.meta.url), "utf8"));

  it("has the 8 cases of the test plan, each with its PNG", () => {
    const names = Object.keys(file.fixtures);
    expect(names).toHaveLength(8);
    for (const n of names) expect(() => readFileSync(new URL(`../../tests/fixtures/${n}`, import.meta.url))).not.toThrow();
  });

  it("scores 100% against itself when the model reads exactly what is expected", () => {
    const [y, m, d] = file.reference_date.split("-").map(Number);
    for (const [name, exp] of Object.entries(file.fixtures) as [string, ExpectedFixture][]) {
      const plans = exp.plans.map((p) => {
        const [py, pm, pd] = p.next_due_date ? p.next_due_date.split("-").map(Number) : [null, null, null];
        return {
          provider_name: p.provider_name, installment_amount: p.installment_amount,
          payments_remaining: p.payments_remaining, frequency: p.frequency,
          due_day: pd, due_month: pm, due_year: p.year_calculated ? null : py,
        };
      });
      const result = parseModelOutput(JSON.stringify({ is_payment_screen: exp.is_payment_screen, plans }), { y, m, d });
      const s = scoreFixture(name, exp, result);
      expect(s, name).toMatchObject({ screenOk: true, invented: [], wrong: [] });
    }
  });
});

describe("classifyServiceError", () => {
  it("quota errors stop the eval", () => {
    expect(classifyServiceError('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}}'))
      .toBe("quota_daily");
    expect(classifyServiceError('{"error":{"code":429,"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}}'))
      .toBe("quota_minute");
  });

  it("a 503 from Google stops the eval", () => {
    expect(classifyServiceError(
      '{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}',
    )).toBe("unavailable");
  });

  it("timeouts and other errors are scored as failures, not skipped", () => {
    expect(classifyServiceError("This operation was aborted")).toBeNull();
    expect(classifyServiceError('{"error":{"code":500,"status":"INTERNAL"}}')).toBeNull();
    expect(classifyServiceError("Gemini devolvió una respuesta vacía.")).toBeNull();
  });
});
