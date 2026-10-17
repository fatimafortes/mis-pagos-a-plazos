"use client";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/client";

export default function SignInButton() {
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    try {
      const supabase = browserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setError("No pude abrir el inicio de sesión con Google. Intenta de nuevo.");
    } catch {
      setError("La app no está configurada todavía (faltan las variables de Supabase).");
    }
  }

  return (
    <>
      <div className="btns">
        <button className="btn primary" onClick={signIn}>Entrar con Google</button>
      </div>
      {error && <p className="banner error">{error}</p>}
    </>
  );
}
