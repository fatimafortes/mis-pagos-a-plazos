"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Completeness } from "@/lib/plans";

const ANSWERS: { value: Completeness; label: string }[] = [
  { value: "complete_as_shown", label: "Sí, ya son todas" },
  { value: "incomplete", label: "Todavía no, voy a subir más" },
  { value: "incomplete_by_choice", label: "Tengo otras, pero no las voy a agregar" },
];

export default function CompletenessQuestion({ current }: { current: Completeness }) {
  const router = useRouter();
  const [saving, setSaving] = useState<Completeness | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function answer(value: Completeness) {
    setSaving(value);
    setError(null);
    try {
      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ completeness: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No pude guardar tu respuesta. Intenta de nuevo.");
        return;
      }
      router.refresh();
    } catch {
      setError("No hay conexión. Intenta de nuevo.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="card">
      <h2>¿Ya me mostraste todas tus apps de pagos a plazos?</h2>
      <div className="answers">
        {ANSWERS.map((a) => (
          <button
            key={a.value}
            type="button"
            className={`btn${current === a.value ? " primary" : ""}`}
            aria-pressed={current === a.value}
            disabled={saving !== null}
            onClick={() => answer(a.value)}
          >
            {saving === a.value ? "Guardando…" : a.label}
          </button>
        ))}
      </div>
      {error && <p className="banner error" role="alert">{error}</p>}
    </div>
  );
}
