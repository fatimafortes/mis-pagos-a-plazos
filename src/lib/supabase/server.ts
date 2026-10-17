import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

export async function serverClient() {
  const env = supabaseEnv();
  if (!env) throw new Error("Faltan las variables de Supabase.");
  const cookieStore = await cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the middleware refreshes the session instead.
        }
      },
    },
  });
}

/** Returns the signed-in user, or null. */
export async function currentUser() {
  const supabase = await serverClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}
