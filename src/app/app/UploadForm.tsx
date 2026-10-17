"use client";
import { useRef, useState } from "react";
import { ACCEPT_ATTR, checkFileMeta } from "@/lib/upload";
import { FIELD_LABEL, PLAN_FIELDS, SOURCE_LABEL, type ExtractedPlan, type PlanField } from "@/lib/extraction";

type Status =
  | { kind: "idle" }
  | { kind: "error"; message: string; simulated?: boolean }
  | { kind: "sending" }
  | { kind: "extracted"; simulated: boolean; plans: ExtractedPlan[] };

function formatValue(plan: ExtractedPlan, field: PlanField): string {
  const value = plan[field];
  if (value === null) return "No aparece en la captura";
  if (field === "installment_amount") {
    return "$" + Number(value).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(value);
}

export default function UploadForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    const check = checkFileMeta(picked);
    if (!check.ok) {
      setFile(null);
      setStatus({ kind: "error", message: check.error });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(picked);
    setStatus({ kind: "idle" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const check = checkFileMeta(file);
    if (!check.ok || !file) {
      setStatus({ kind: "error", message: check.ok ? "Elige una captura de pantalla." : check.error });
      return;
    }
    setStatus({ kind: "sending" });
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({
          kind: "error",
          message: data.error ?? "No pude subir la captura. Intenta de nuevo.",
          simulated: data.simulated,
        });
        return;
      }
      setStatus({ kind: "extracted", simulated: Boolean(data.simulated), plans: data.plans ?? [] });
    } catch {
      setStatus({ kind: "error", message: "No hay conexión. Intenta de nuevo." });
    }
  }

  return (
    <>
      <form className="card" onSubmit={onSubmit}>
        <h2>Sube una captura</h2>
        <p className="small muted" style={{ marginTop: 4 }}>
          La pantalla de pagos de una app a plazos. PNG o JPG, máximo 5 MB. No guardo la imagen.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          onChange={onPick}
          aria-label="Captura de pantalla"
          style={{ marginTop: 12, width: "100%" }}
        />
        {file && <p className="small muted" style={{ marginTop: 6 }}>{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
        <div className="btns">
          <button className="btn primary" type="submit" disabled={!file || status.kind === "sending"}>
            {status.kind === "sending" ? "Leyendo captura…" : "Leer captura"}
          </button>
        </div>
        {status.kind === "error" && (
          <p className="banner error" role="alert">
            {status.message}
            {status.simulated && <span className="sim-tag">SIMULADO</span>}
          </p>
        )}
      </form>

      {status.kind === "extracted" && (
        <section aria-live="polite">
          <h2 style={{ marginTop: 20 }}>
            Esto leí de tu captura
            {status.simulated && <span className="sim-tag">SIMULADO</span>}
          </h2>
          {status.simulated && (
            <p className="small muted" style={{ marginTop: 4 }}>
              Respuesta de ejemplo: no se leyó tu imagen.
            </p>
          )}
          {status.plans.map((plan, i) => (
            <div className="card" key={i}>
              {PLAN_FIELDS.map((field) => (
                <div key={field} style={{ marginBottom: 10 }}>
                  <div className="small muted">{FIELD_LABEL[field]}</div>
                  <div className={plan[field] === null ? "muted" : undefined}>{formatValue(plan, field)}</div>
                  <span className={`tag t-${plan.field_sources[field]}`}>{SOURCE_LABEL[plan.field_sources[field]]}</span>
                </div>
              ))}
            </div>
          ))}
          <p className="small muted" style={{ marginTop: 10 }}>La imagen no se guardó.</p>
        </section>
      )}
    </>
  );
}
