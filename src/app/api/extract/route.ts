import { NextResponse } from "next/server";
import { currentUser } from "@/lib/supabase/server";
import { MAX_BYTES, checkFileBytes } from "@/lib/upload";

export const dynamic = "force-dynamic";

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

  // F5 adds the vision extraction here.
  return NextResponse.json({ ok: true, type: check.type, size: bytes.length });
}
