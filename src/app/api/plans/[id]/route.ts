import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Blueprint condition 3: the user can delete their own data.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para borrar tus planes." }, { status: 401 });

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Ese plan no existe." }, { status: 400 });
  }

  // RLS only lets this delete touch the user's own rows; the user_id filter states it explicitly.
  const { data, error } = await supabase
    .from("w10_payment_plans")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error) {
    console.error("[api/plans/:id] delete falló:", { code: error.code, message: error.message });
    return NextResponse.json({ error: "No pude borrar el plan. Intenta de nuevo." }, { status: 500 });
  }
  if (!data || data.length === 0) return NextResponse.json({ error: "Ese plan no existe." }, { status: 404 });
  return NextResponse.json({ deleted: id });
}
