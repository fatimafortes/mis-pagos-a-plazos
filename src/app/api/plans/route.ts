import { NextResponse } from "next/server";
import { currentUser } from "@/lib/supabase/server";
import { todayInMexico } from "@/lib/extraction";
import { confirmedPlanSchema } from "@/lib/plans";

export const dynamic = "force-dynamic";

const MAX_BODY = 10 * 1024;

export async function POST(request: Request) {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para guardar tus pagos." }, { status: 401 });

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) {
    return NextResponse.json({ error: "Los datos son demasiado grandes." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "No pude leer los datos. Intenta de nuevo." }, { status: 400 });
  }

  // Validate again on the server even though the form already did (hard rule 6).
  const parsed = confirmedPlanSchema(todayInMexico()).safeParse((body as { plan?: unknown } | null)?.plan);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revisa los datos: " + parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  }

  // user_id comes from the session, never from the request body; RLS checks it again.
  const { data, error } = await supabase
    .from("w10_payment_plans")
    .insert({ ...parsed.data, user_id: user.id })
    .select("id")
    .single();
  if (error) {
    console.error("[api/plans] insert falló:", { code: error.code, message: error.message });
    return NextResponse.json({ error: "No pude guardar el plan. Intenta de nuevo." }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
