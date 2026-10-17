"use client";
import { useRef, useState } from "react";
import { ACCEPT_ATTR, checkFileMeta } from "@/lib/upload";

type Status =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "sending" }
  | { kind: "accepted" };

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
        setStatus({ kind: "error", message: data.error ?? "No pude subir la captura. Intenta de nuevo." });
        return;
      }
      setStatus({ kind: "accepted" });
    } catch {
      setStatus({ kind: "error", message: "No hay conexión. Intenta de nuevo." });
    }
  }

  return (
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
          {status.kind === "sending" ? "Subiendo…" : "Leer captura"}
        </button>
      </div>
      {status.kind === "error" && <p className="banner error" role="alert">{status.message}</p>}
      {status.kind === "accepted" && <p className="banner ok">Captura válida. La imagen no se guardó.</p>}
    </form>
  );
}
