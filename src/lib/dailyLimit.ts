// Daily screenshot limit per user, counted in Mexico City days (protects the free Gemini quota).
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatYMD, todayInMexico } from "./extraction";

export const DAILY_LIMIT = 10;
export const LIMIT_MESSAGE =
  "Llegaste al límite de 10 capturas por hoy. Puedes capturar tus planes a mano o volver mañana.";

/** Midnight today in Mexico City as an ISO timestamp (no daylight saving there since 2022). */
export function startOfTodayMexico(now = new Date()): string {
  return `${formatYMD(todayInMexico(now))}T00:00:00-06:00`;
}

export type LimitCheck =
  | { allowed: true; remaining: number | null } // null: the count could not be read
  | { allowed: false };

/** Counts today's screenshots and records this one if it's allowed. */
export async function claimDailyScreenshot(supabase: SupabaseClient, userId: string, now = new Date()): Promise<LimitCheck> {
  const { count, error } = await supabase
    .from("w10_extraction_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfTodayMexico(now));
  if (error) {
    // Fail open: a missing log table must not block uploads; the error is logged to fix it.
    console.error("[dailyLimit] no pude contar capturas:", { code: error.code, message: error.message });
    return { allowed: true, remaining: null };
  }
  const used = count ?? 0;
  if (used >= DAILY_LIMIT) return { allowed: false };

  const { error: insertError } = await supabase.from("w10_extraction_log").insert({ user_id: userId });
  if (insertError) console.error("[dailyLimit] no pude registrar la captura:", { code: insertError.code, message: insertError.message });
  return { allowed: true, remaining: DAILY_LIMIT - used - 1 };
}
