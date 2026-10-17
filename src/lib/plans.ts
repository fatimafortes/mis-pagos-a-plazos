// Confirmed plans: what the user reviewed and what the server accepts for w10_payment_plans.
// The same field rules run in the review form and again on the server (hard rule 6).
import { z } from "zod";
import { parseDate, type Frequency, type PlanInput, type YMD } from "./quincenas";
import { PLAN_FIELDS, isWithinTwoYears, type ExtractedPlan, type FieldSource, type PlanField } from "./extraction";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const FREQUENCY_OPTIONS: Frequency[] = ["semanal", "quincenal", "mensual"];

/** Per-field rules, with messages shown next to the input. */
export function fieldSchemas(today: YMD) {
  return {
    provider_name: z.string().trim().min(1, "Escribe el nombre de la app.").max(60, "Máximo 60 caracteres.").nullable(),
    installment_amount: z
      .number({ error: "Escribe un monto válido." })
      .min(0, "El monto no puede ser negativo.")
      .max(100000, "El monto máximo es $100,000.")
      .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, "Máximo 2 decimales.")
      .nullable(),
    payments_remaining: z
      .number({ error: "Escribe un número de pagos." })
      .int("Los pagos deben ser un número entero.")
      .min(0, "No puede ser negativo.")
      .max(60, "Máximo 60 pagos.")
      .nullable(),
    next_due_date: z
      .string()
      .refine((s) => {
        const d = parseDate(s);
        return d !== null && isWithinTwoYears(d, today);
      }, "Elige una fecha dentro de los próximos 2 años.")
      .nullable(),
    frequency: z.enum(FREQUENCY_OPTIONS, { error: "Elige una frecuencia." }).nullable(),
  } satisfies Record<PlanField, z.ZodType>;
}

const source = z.enum(["screenshot", "user", "unknown"]);

export function confirmedPlanSchema(today: YMD) {
  return z
    .strictObject({
      ...fieldSchemas(today),
      field_sources: z.strictObject({
        provider_name: source,
        installment_amount: source,
        payments_remaining: source,
        next_due_date: source,
        frequency: source,
        // Day and month came from the screenshot; the year was calculated by code.
        next_due_date_year: z.literal("calculated").optional(),
        // Saved from a SIMULADO extraction: invented data, not read from the user's image.
        simulated: z.literal(true).optional(),
      }),
    })
    .superRefine((plan, ctx) => {
      if (PLAN_FIELDS.every((f) => plan[f] === null)) {
        ctx.addIssue({ code: "custom", path: [], message: "Captura al menos un dato del plan." });
      }
      for (const f of PLAN_FIELDS) {
        if ((plan[f] === null) !== (plan.field_sources[f] === "unknown")) {
          ctx.addIssue({ code: "custom", path: ["field_sources", f], message: "Fuente inconsistente con el valor." });
        }
      }
      if (plan.field_sources.next_due_date_year && plan.field_sources.next_due_date !== "screenshot") {
        ctx.addIssue({ code: "custom", path: ["field_sources", "next_due_date_year"], message: "Año calculado sin fecha leída." });
      }
    });
}

export type ConfirmedPlan = z.infer<ReturnType<typeof confirmedPlanSchema>>;

/** Starting point for "Capturar a mano": every field unknown until the user types it. */
export function emptyManualPlan(): ExtractedPlan {
  return {
    provider_name: null, installment_amount: null, payments_remaining: null, next_due_date: null, frequency: null,
    field_sources: Object.fromEntries(PLAN_FIELDS.map((f) => [f, "unknown"])) as Record<PlanField, FieldSource>,
    year_calculated: false,
  };
}

/** True when no field came from a screenshot: the plan was entered by hand. */
export function isManualPlan(sources: Record<PlanField, FieldSource>): boolean {
  return PLAN_FIELDS.every((f) => sources[f] !== "screenshot");
}

/** What the review form sends when the user presses Confirmar. */
export function toConfirmedPlan(
  values: PlanInput,
  sources: Record<PlanField, FieldSource>,
  yearCalculated: boolean,
  simulated = false,
): ConfirmedPlan {
  const { provider_name, installment_amount, payments_remaining, next_due_date, frequency } = values;
  return {
    provider_name, installment_amount, payments_remaining, next_due_date, frequency,
    field_sources: {
      ...sources,
      ...(yearCalculated && sources.next_due_date === "screenshot" ? { next_due_date_year: "calculated" as const } : {}),
      ...(simulated ? { simulated: true as const } : {}),
    },
  };
}

export type StoredSources = ConfirmedPlan["field_sources"];

export interface SavedPlan extends PlanInput {
  id: string;
  field_sources: StoredSources;
  simulated: boolean;
}

export const SAVED_PLAN_COLUMNS =
  "id, provider_name, installment_amount, payments_remaining, next_due_date, frequency, field_sources";

/** A w10_payment_plans row as the results screen uses it. Postgres numeric may arrive as a string. */
export function rowToSavedPlan(row: {
  id: string;
  provider_name: string | null;
  installment_amount: number | string | null;
  payments_remaining: number | null;
  next_due_date: string | null;
  frequency: string | null;
  field_sources: StoredSources;
}): SavedPlan {
  return {
    id: row.id,
    provider_name: row.provider_name,
    installment_amount: row.installment_amount === null ? null : Number(row.installment_amount),
    payments_remaining: row.payments_remaining,
    next_due_date: row.next_due_date,
    frequency: FREQUENCY_OPTIONS.includes(row.frequency as Frequency) ? (row.frequency as Frequency) : null,
    field_sources: row.field_sources,
    simulated: row.field_sources?.simulated === true,
  };
}

export const COMPLETENESS = ["incomplete", "complete_as_shown", "incomplete_by_choice"] as const;
export type Completeness = (typeof COMPLETENESS)[number];
export const completenessSchema = z.strictObject({ completeness: z.enum(COMPLETENESS) });

/** Short tag next to a total. */
export const COMPLETENESS_SHORT: Record<Completeness, string> = {
  incomplete: "incompleto: solo lo que me mostraste",
  complete_as_shown: "completo hasta donde me mostraste",
  incomplete_by_choice: "incompleto por tu decisión",
};

export const COMPLETENESS_BANNER: Record<Completeness, { title: string; body: string }> = {
  incomplete: {
    title: "Vista incompleta",
    body: "Solo incluye lo que me has mostrado. Puede que debas más en apps que no me has enseñado.",
  },
  complete_as_shown: {
    title: "Completa hasta donde me has mostrado",
    body: "Me dijiste que ya son todas tus apps de pagos a plazos.",
  },
  incomplete_by_choice: {
    title: "Incompleta por tu decisión",
    body: "Me dijiste que tienes otros pagos que prefieres no agregar. Estos totales no los incluyen.",
  },
};

/** Applies one edit: a changed value becomes "Tú me lo dijiste", a cleared one unknown, an unchanged one stays. */
export function applyEdit(
  plan: Pick<ExtractedPlan, "field_sources" | "year_calculated"> & PlanInput,
  field: PlanField,
  value: PlanInput[PlanField],
): Pick<ExtractedPlan, "field_sources" | "year_calculated"> & PlanInput {
  if (plan[field] === value) return plan;
  return {
    ...plan,
    [field]: value,
    field_sources: { ...plan.field_sources, [field]: value === null ? "unknown" : "user" },
    year_calculated: field === "next_due_date" ? false : plan.year_calculated,
  };
}

/** Turns the text in an input into a typed value (empty → null). Validation happens separately. */
export function parseDraft(field: PlanField, draft: string): PlanInput[PlanField] {
  const text = draft.trim();
  if (text === "") return null;
  if (field === "installment_amount") return Number(text.replace(/[$,\s]/g, ""));
  if (field === "payments_remaining") return Number(text);
  if (field === "frequency") return text as Frequency;
  return text;
}

export function toDraft(value: PlanInput[PlanField]): string {
  return value === null ? "" : String(value);
}

export function formatField(field: PlanField, value: PlanInput[PlanField]): string {
  if (value === null) return "No aparece en la captura";
  if (field === "installment_amount") {
    return "$" + Number(value).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (field === "next_due_date") {
    const d = parseDate(String(value));
    return d ? `${d.d} ${MONTHS[d.m - 1]} ${d.y}` : String(value);
  }
  if (field === "payments_remaining") return value === 1 ? "1 pago" : `${value} pagos`;
  return String(value);
}
