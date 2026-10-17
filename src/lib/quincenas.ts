// Deterministic quincena engine. The LLM never touches this (Condition C2).
// All money is handled in integer centavos.

export type Frequency = "semanal" | "quincenal" | "mensual";

export interface PlanInput {
  id?: string;
  provider_name: string | null;
  installment_amount: number | null;
  payments_remaining: number | null;
  next_due_date: string | null; // YYYY-MM-DD
  frequency: Frequency | null;
  simulated?: boolean; // saved from a SIMULADO extraction
}

export interface YMD { y: number; m: number; d: number } // m = 1..12

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function parseDate(s: string): YMD | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function toCentavos(amount: number): number {
  return Math.round(amount * 100);
}

export function formatPesos(centavos: number): string {
  const pesos = centavos / 100;
  return "$" + pesos.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Quincena index: consecutive integers, two per month. */
export function quincenaIndex(date: YMD): number {
  return date.y * 24 + (date.m - 1) * 2 + (date.d <= 15 ? 0 : 1);
}

export function quincenaLabel(index: number): string {
  const y = Math.floor(index / 24);
  const m = Math.floor((index % 24) / 2) + 1;
  const half = index % 2;
  const range = half === 0 ? "1–15" : `16–${daysInMonth(y, m)}`;
  return `${range} ${MONTHS[m - 1]}`;
}

function addDays(date: YMD, days: number): YMD {
  const t = new Date(Date.UTC(date.y, date.m - 1, date.d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function addMonthsClamped(start: YMD, months: number): YMD {
  const total = start.m - 1 + months;
  const y = start.y + Math.floor(total / 12);
  const m = (total % 12) + 1;
  return { y, m, d: Math.min(start.d, daysInMonth(y, m)) };
}

/** Quincena index of each remaining payment. */
export function paymentQuincenas(start: YMD, frequency: Frequency, count: number): number[] {
  const first = quincenaIndex(start);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    if (frequency === "quincenal") out.push(first + i);
    else if (frequency === "mensual") out.push(quincenaIndex(addMonthsClamped(start, i)));
    else out.push(quincenaIndex(addDays(start, 7 * i)));
  }
  return out;
}

export function missingFields(plan: PlanInput): string[] {
  const missing: string[] = [];
  if (plan.installment_amount === null) missing.push("el monto");
  if (plan.payments_remaining === null) missing.push("los pagos restantes");
  if (plan.next_due_date === null || parseDate(plan.next_due_date) === null) missing.push("la próxima fecha");
  if (plan.frequency === null) missing.push("la frecuencia");
  return missing;
}

/** One line per saved plan; `key` is the plan id (or its position when there is none). */
export interface RowItem { key: string; provider: string; centavos: number; simulated?: boolean }
/** totalCentavos counts real plans only; simulated items are listed but never added. */
export interface Row { index: number; label: string; totalCentavos: number; items: RowItem[] }
export interface Undated {
  id?: string;
  provider: string;
  missing: string[];
  totalCentavos: number | null;
  payments: number | null;
  simulated?: boolean;
}
export interface Schedule {
  rows: Row[];
  undated: Undated[];
  beforeCentavos: number; // real payments dated before the current quincena
  afterCentavos: number;  // real payments beyond the horizon
}

export function buildSchedule(plans: PlanInput[], today: YMD, horizon = 6): Schedule {
  const start = quincenaIndex(today);
  const rows: Row[] = Array.from({ length: horizon }, (_, i) => ({
    index: start + i, label: quincenaLabel(start + i), totalCentavos: 0, items: [],
  }));
  const undated: Undated[] = [];
  let beforeCentavos = 0;
  let afterCentavos = 0;

  for (const [i, plan] of plans.entries()) {
    const key = plan.id ?? `#${i}`;
    const provider = plan.provider_name?.trim() || "App sin nombre";
    const missing = missingFields(plan);
    if (missing.length > 0) {
      const total = plan.installment_amount !== null && plan.payments_remaining !== null
        ? toCentavos(plan.installment_amount) * plan.payments_remaining
        : null;
      undated.push({
        id: plan.id, provider, missing, totalCentavos: total, payments: plan.payments_remaining,
        simulated: plan.simulated,
      });
      continue;
    }
    const amount = toCentavos(plan.installment_amount!);
    // Simulated (invented) amounts are shown but never summed into any total.
    const simulated = plan.simulated === true;
    const counted = simulated ? 0 : amount;
    for (const q of paymentQuincenas(parseDate(plan.next_due_date!)!, plan.frequency!, plan.payments_remaining!)) {
      if (q < start) beforeCentavos += counted;
      else if (q >= start + horizon) afterCentavos += counted;
      else {
        const row = rows[q - start];
        row.totalCentavos += counted;
        // Each plan keeps its own line, even if another plan has the same app name.
        const existing = row.items.find((it) => it.key === key);
        if (existing) existing.centavos += amount; // e.g. two weekly payments in one quincena
        else row.items.push(simulated ? { key, provider, centavos: amount, simulated } : { key, provider, centavos: amount });
      }
    }
  }
  return { rows, undated, beforeCentavos, afterCentavos };
}
