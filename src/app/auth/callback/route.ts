import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Diagnostics only: never log the code or any token.
  const providerError = searchParams.get("error");
  if (providerError) {
    console.error("[auth/callback] Supabase devolvió error:", {
      error: providerError,
      error_code: searchParams.get("error_code"),
      error_description: searchParams.get("error_description"),
    });
  }

  if (code) {
    const supabase = await serverClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/app`);
    console.error("[auth/callback] exchangeCodeForSession falló:", {
      name: error.name,
      status: error.status,
      code: error.code,
      message: error.message,
    });
  } else if (!providerError) {
    console.error("[auth/callback] Llegó sin code ni error. Params:", [...searchParams.keys()]);
  }
  return NextResponse.redirect(`${origin}/?error=login`);
}
