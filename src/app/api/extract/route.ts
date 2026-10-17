import { NextResponse } from "next/server";
import { currentUser } from "@/lib/supabase/server";
import { MAX_BYTES, checkFileBytes } from "@/lib/upload";
import { runExtraction, todayInMexico } from "@/lib/extraction";
import { callGemini } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // Gemini can take a few seconds per image.

// Multipart overhead on top of the 5 MB image.
const MAX_BODY = MAX_BYTES + 64 * 1024;

export async function POST(request: Request) {
  const { user } = await currentUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para subir capturas." }, { status: 401 });

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY) {
    return NextResponse.json({ error: "La captura pesa más de 5 MB. Recórtala o tómala de nuevo." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "No pude leer el archivo. Intenta de nuevo." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Elige una captura de pantalla." }, { status: 400 });
  }

  // The image stays in this request's memory only: no Storage bucket, no DB column (C4).
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkFileBytes({ type: file.type, size: file.size }, bytes);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const result = await runExtraction({
    bytes,
    mimeType: check.type,
    today: todayInMexico(),
    simulate: process.env.SIMULATE_AI === "true",
    callModel: callGemini,
    onModelError: (err) =>
      console.error("[api/extract] Gemini falló, uso respuesta simulada:", err instanceof Error ? err.message : err),
  });

  if (result.kind === "invalid_output") {
    return NextResponse.json(
      { error: "No pude leer la captura con seguridad. Intenta con otra o vuelve a tomarla." },
      { status: 502 },
    );
  }
  if (result.kind === "rejected") {
    return NextResponse.json({ error: result.message, simulated: result.simulated }, { status: 422 });
  }
  return NextResponse.json({ simulated: result.simulated, plans: result.plans });
}
