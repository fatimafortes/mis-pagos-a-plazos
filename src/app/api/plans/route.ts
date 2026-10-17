import { NextResponse } from "next/server";
import { currentUser } from "@/lib/supabase/server";
import { todayInMexico } from "@/lib/extraction";
import {
  SAVED_PLAN_COLUMNS, confirmedPlanSchema, duplicateQuestion, findDuplicate, isManualPlan, rowToSavedPlan,
} from "@/lib/plans";

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

  // Same app, amount, date and frequency as a saved plan: ask before saving it twice,
  // unless the user already answered "Es otra compra, guardar".
  if ((body as { allowDuplicate?: unknown }).allowDuplicate !== true) {
    const { data: rows, error: readError } = await supabase
      .from("w10_payment_plans")
      .select(SAVED_PLAN_COLUMNS)
      .eq("user_id", user.id);
    if (readError) {
      console.error("[api/plans] leer planes para duplicados falló:", { code: readError.code, message: readError.message });
    } else if (findDuplicate(parsed.data, (rows ?? []).map(rowToSavedPlan))) {
      return NextResponse.json(
        { duplicate: true, error: duplicateQuestion(parsed.data.provider_name) },
        { status: 409 },
      );
    }
  }

  // In simulation mode every extraction is invented, whatever the client says.
  // A plan typed by hand has no screenshot fields and is never simulated.
  const plan = parsed.data;
  if (isManualPlan(plan.field_sources)) delete plan.field_sources.simulated;
  else if (process.env.SIMULATE_AI === "true") plan.field_sources = { ...plan.field_sources, simulated: true };

  // user_id comes from the session, never from the request body; RLS checks it again.
  const { data, error } = await supabase
    .from("w10_payment_plans")
    .insert({ ...plan, user_id: user.id })
    .select("id")
    .single();
  if (error) {
    console.error("[api/plans] insert falló:", { code: error.code, message: error.message });
    return NextResponse.json({ error: "No pude guardar el plan. Intenta de nuevo." }, { status: 500 });
  }

  // A new plan means "these are all my apps" no longer holds; ask again.
  const { error: statusError } = await supabase
    .from("w10_ledger_status")
    .update({ completeness: "incomplete", updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("completeness", "complete_as_shown");
  if (statusError) console.error("[api/plans] reset de completitud falló:", { code: statusError.code, message: statusError.message });

  return NextResponse.json({ id: data.id }, { status: 201 });
}
