"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FIELD_LABEL, PLAN_FIELDS, SOURCE_LABEL, YEAR_CALCULATED_LABEL } from "@/lib/extraction";
import { formatField, type SavedPlan } from "@/lib/plans";

type Mode = "idle" | "asking" | "deleting";

export default function SavedPlanCard({ plan }: { plan: SavedPlan }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setMode("deleting");
    setError(null);
    try {
      const res = await fetch(`/api/plans/${plan.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No pude borrar el plan. Intenta de nuevo.");
        setMode("idle");
        return;
      }
      router.refresh();
    } catch {
      setError("No hay conexión. Intenta de nuevo.");
      setMode("idle");
    }
  }

  return (
    <div className="card">
      <h2>
        {plan.provider_name ?? "App sin nombre"}
        {plan.simulated && <span className="sim-tag">SIMULADO</span>}
      </h2>
      {PLAN_FIELDS.filter((f) => f !== "provider_name").map((field) => {
        const src = plan.field_sources[field];
        const yearCalculated = field === "next_due_date" && plan.field_sources.next_due_date_year === "calculated";
        return (
          <div key={field} className="saved-row">
            <span className="small muted">{FIELD_LABEL[field]}</span>
            <span className={plan[field] === null ? "muted" : undefined}>
              {plan[field] === null ? "Desconocido" : formatField(field, plan[field])}
            </span>
            <span className={`tag t-${src}`}>{yearCalculated ? YEAR_CALCULATED_LABEL : SOURCE_LABEL[src]}</span>
          </div>
        );
      })}

      {mode === "idle" && (
        <div className="btns">
          <button className="btn danger" type="button" onClick={() => setMode("asking")}>Borrar</button>
        </div>
      )}
      {mode !== "idle" && (
        <div className="banner error" role="alertdialog" aria-label="Confirmar borrado">
          <b>¿Borrar este plan?</b>
          Se borra de tu cuenta y deja de contar en tus quincenas. No se puede deshacer.
          <div className="btns">
            <button className="btn danger" type="button" onClick={remove} disabled={mode === "deleting"}>
              {mode === "deleting" ? "Borrando…" : "Sí, borrar"}
            </button>
            <button className="btn" type="button" onClick={() => setMode("idle")} disabled={mode === "deleting"}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {error && <p className="banner error" role="alert">{error}</p>}
    </div>
  );
}
