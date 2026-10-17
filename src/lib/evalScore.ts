// Scores extraction results against tests/fixtures/expected.json (PACKET §3 success definition).
import { PLAN_FIELDS, type ExtractResult, type ExtractedPlan, type PlanField } from "./extraction";
import type { PlanInput } from "./quincenas";

export interface ExpectedPlan extends Omit<PlanInput, "id" | "simulated"> {
  year_calculated: boolean;
}

export interface ExpectedFixture {
  case: string;
  is_payment_screen: boolean;
  plans: ExpectedPlan[];
}

export interface FixtureScore {
  name: string;
  /** Payment screen extracted / non-payment screen rejected, as expected. */
  screenOk: boolean;
  fieldsCorrect: number;
  fieldsTotal: number;
  /** Fields that came back with a value where the screenshot shows none. Target: 0. */
  invented: string[];
  /** Expected values that were missed or read wrong. */
  wrong: string[];
}

function sameValue(field: PlanField, expected: unknown, got: unknown): boolean {
  if (field === "installment_amount" && typeof expected === "number" && typeof got === "number") {
    return Math.round(expected * 100) === Math.round(got * 100); // compare in centavos
  }
  return expected === got;
}

const show = (v: unknown) => (v === null ? "null" : JSON.stringify(v));

export function scoreFixture(name: string, expected: ExpectedFixture, result: ExtractResult): FixtureScore {
  const score: FixtureScore = { name, screenOk: false, fieldsCorrect: 0, fieldsTotal: 0, invented: [], wrong: [] };
  const got: ExtractedPlan[] = result.kind === "plans" ? result.plans : [];

  score.screenOk = expected.is_payment_screen ? result.kind === "plans" : result.kind === "rejected";

  expected.plans.forEach((exp, i) => {
    const plan = got[i];
    for (const field of PLAN_FIELDS) {
      score.fieldsTotal++;
      const value = plan ? plan[field] : null;
      // A plan that was never extracted gets no credit, not even for its expected nulls.
      let ok = plan !== undefined && sameValue(field, exp[field], value);
      // A date is only right if we also know whether its year was read or calculated.
      if (ok && field === "next_due_date" && plan && exp.next_due_date !== null) {
        ok = plan.year_calculated === exp.year_calculated;
      }
      if (ok) score.fieldsCorrect++;
      else if (!plan) score.wrong.push(`plan ${i + 1} · ${field}: no se extrajo el plan`);
      else if (exp[field] === null) score.invented.push(`plan ${i + 1} · ${field}: ${show(value)} (no se ve)`);
      else score.wrong.push(`plan ${i + 1} · ${field}: esperado ${show(exp[field])}, leído ${show(value)}`);
    }
  });

  // Plans the model reported beyond the expected ones: every value in them is invented.
  got.slice(expected.plans.length).forEach((plan, j) => {
    for (const field of PLAN_FIELDS) {
      if (plan[field] !== null) score.invented.push(`plan extra ${expected.plans.length + j + 1} · ${field}: ${show(plan[field])}`);
    }
  });

  return score;
}

export interface EvalSummary {
  fieldsCorrect: number;
  fieldsTotal: number;
  accuracy: number;
  invented: number;
  screensOk: number;
  screensTotal: number;
  passed: boolean;
}

export const TARGET_ACCURACY = 0.95;

export function summarize(scores: FixtureScore[]): EvalSummary {
  const fieldsCorrect = scores.reduce((n, s) => n + s.fieldsCorrect, 0);
  const fieldsTotal = scores.reduce((n, s) => n + s.fieldsTotal, 0);
  const invented = scores.reduce((n, s) => n + s.invented.length, 0);
  const screensOk = scores.filter((s) => s.screenOk).length;
  const accuracy = fieldsTotal === 0 ? 1 : fieldsCorrect / fieldsTotal;
  return {
    fieldsCorrect, fieldsTotal, accuracy, invented, screensOk, screensTotal: scores.length,
    passed: accuracy >= TARGET_ACCURACY && invented === 0 && screensOk === scores.length,
  };
}
