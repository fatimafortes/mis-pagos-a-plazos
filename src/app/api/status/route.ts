import { NextResponse } from "next/server";
import { currentUser } from "@/lib/supabase/server";
import { completenessSchema } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión primero." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "No pude leer tu respuesta. Intenta de nuevo." }, { status: 400 });
  }
  const parsed = completenessSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Respuesta no válida." }, { status: 400 });

  const { error } = await supabase
    .from("w10_ledger_status")
    .upsert({ user_id: user.id, completeness: parsed.data.completeness, updated_at: new Date().toISOString() });
  if (error) {
    console.error("[api/status] upsert falló:", { code: error.code, message: error.message });
    return NextResponse.json({ error: "No pude guardar tu respuesta. Intenta de nuevo." }, { status: 500 });
  }
  return NextResponse.json({ completeness: parsed.data.completeness });
}
