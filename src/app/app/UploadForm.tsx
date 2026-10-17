"use client";
import { useRef, useState } from "react";
import { ACCEPT_ATTR, checkFileMeta } from "@/lib/upload";
import type { ExtractedPlan } from "@/lib/extraction";
import { emptyManualPlan } from "@/lib/plans";
import ReviewPlan from "./ReviewPlan";

type Status =
  | { kind: "idle" }
  | { kind: "error"; message: string; simulated?: boolean }
  | { kind: "sending" }
  | { kind: "extracted"; simulated: boolean; plans: ExtractedPlan[] };

export default function UploadForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [extractionId, setExtractionId] = useState(0);
  const [manualId, setManualId] = useState<number | null>(null); // open "Capturar a mano" card

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
      setExtractionId((n) => n + 1);
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
          <button className="btn" type="button" onClick={() => setManualId((n) => (n ?? 0) + 1)}>
            Capturar a mano
          </button>
        </div>
        {status.kind === "error" && (
          <p className="banner error" role="alert">
            {status.message}
            {status.simulated && <span className="sim-tag">SIMULADO</span>}
          </p>
        )}
      </form>

      {manualId !== null && (
        <section aria-live="polite">
          <h2 style={{ marginTop: 20 }}>Captura a mano</h2>
          <p className="small muted" style={{ marginTop: 4 }}>
            Escribe lo que ves en tu app. Todo lo que escribas queda como “Tú me lo dijiste”.
          </p>
          <ReviewPlan
            key={`manual-${manualId}`}
            plan={emptyManualPlan()}
            simulated={false}
            manual
            onClose={() => setManualId(null)}
          />
        </section>
      )}

      {status.kind === "extracted" && (
        <section aria-live="polite">
          <h2 style={{ marginTop: 20 }}>Revisa lo que leí de tu captura</h2>
          <p className="small muted" style={{ marginTop: 4 }}>
            {status.simulated
              ? "Respuesta de ejemplo (SIMULADO): no se leyó tu imagen."
              : "Confirma cada plan o corrígelo si algo no coincide. La imagen no se guardó."}
          </p>
          {status.plans.map((plan, i) => (
            <ReviewPlan key={`${extractionId}-${i}`} plan={plan} simulated={status.simulated} />
          ))}
        </section>
      )}
    </>
  );
}
