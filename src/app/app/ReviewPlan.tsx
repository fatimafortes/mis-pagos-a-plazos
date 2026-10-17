"use client";
import { useId, useMemo, useState } from "react";
import {
  FIELD_LABEL, PLAN_FIELDS, SOURCE_LABEL, YEAR_CALCULATED_LABEL, todayInMexico, type ExtractedPlan, type PlanField,
} from "@/lib/extraction";
import {
  FREQUENCY_OPTIONS, applyEdit, fieldSchemas, formatField, parseDraft, toConfirmedPlan, toDraft,
} from "@/lib/plans";

type Mode = "review" | "edit" | "saving" | "saved";

export default function ReviewPlan({ plan: extracted, simulated }: { plan: ExtractedPlan; simulated: boolean }) {
  const uid = useId();
  const schemas = useMemo(() => fieldSchemas(todayInMexico()), []);
  const [plan, setPlan] = useState(extracted);
  const [drafts, setDrafts] = useState(
    () => Object.fromEntries(PLAN_FIELDS.map((f) => [f, toDraft(extracted[f])])) as Record<PlanField, string>,
  );
  const [errors, setErrors] = useState<Partial<Record<PlanField, string>>>({});
  const [mode, setMode] = useState<Mode>("review");
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasErrors = Object.values(errors).some(Boolean);
  const title = plan.provider_name ?? "App sin nombre";

  function onDraft(field: PlanField, draft: string) {
    setDrafts((d) => ({ ...d, [field]: draft }));
    const check = schemas[field].safeParse(parseDraft(field, draft));
    if (!check.success) {
      setErrors((e) => ({ ...e, [field]: check.error.issues[0]?.message ?? "Valor no válido." }));
      return;
    }
    setErrors((e) => ({ ...e, [field]: undefined }));
    setPlan((p) => applyEdit(p, field, check.data as ExtractedPlan[PlanField]));
  }

  async function confirm() {
    if (hasErrors) return;
    setMode("saving");
    setSaveError(null);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: toConfirmedPlan(plan, plan.field_sources, plan.year_calculated) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error ?? "No pude guardar el plan. Intenta de nuevo.");
        setMode("edit");
        return;
      }
      setMode("saved");
    } catch {
      setSaveError("No hay conexión. Intenta de nuevo.");
      setMode("review");
    }
  }

  function sourceTag(field: PlanField) {
    const src = plan.field_sources[field];
    const text = field === "next_due_date" && plan.year_calculated ? YEAR_CALCULATED_LABEL : SOURCE_LABEL[src];
    return <span className={`tag t-${src}`}>{text}</span>;
  }

  function input(field: PlanField) {
    const common = {
      id: `${uid}-${field}`,
      value: drafts[field],
      "aria-invalid": Boolean(errors[field]),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onDraft(field, e.target.value),
      className: "field-input",
    };
    if (field === "frequency") {
      return (
        <select {...common}>
          <option value="">— No sé</option>
          {FREQUENCY_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      );
    }
    if (field === "next_due_date") return <input {...common} type="date" />;
    if (field === "installment_amount") return <input {...common} inputMode="decimal" placeholder="$0.00" />;
    if (field === "payments_remaining") return <input {...common} inputMode="numeric" placeholder="0" />;
    return <input {...common} maxLength={60} placeholder="Nombre de la app" />;
  }

  const editing = mode === "edit";

  return (
    <div className="card">
      <h2>
        {title}
        {simulated && <span className="sim-tag">SIMULADO</span>}
      </h2>
      {PLAN_FIELDS.map((field) => (
        <div key={field} className="field">
          <label className="small muted" htmlFor={`${uid}-${field}`}>{FIELD_LABEL[field]}</label>
          {editing ? input(field) : (
            <div className={plan[field] === null ? "muted" : undefined}>{formatField(field, plan[field])}</div>
          )}
          {errors[field] && <div className="small field-error" role="alert">{errors[field]}</div>}
          {sourceTag(field)}
        </div>
      ))}

      {mode === "saved" ? (
        <p className="banner ok">Guardado. Ya cuenta en tus quincenas.</p>
      ) : (
        <div className="btns">
          <button className="btn primary" type="button" onClick={confirm} disabled={mode === "saving" || hasErrors}>
            {mode === "saving" ? "Guardando…" : "Confirmar"}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => setMode(mode === "edit" ? "review" : "edit")}
            disabled={mode === "saving" || (mode === "edit" && hasErrors)}
          >
            {mode === "edit" ? "Listo" : "Corregir"}
          </button>
        </div>
      )}
      {saveError && <p className="banner error" role="alert">{saveError}</p>}
    </div>
  );
}
