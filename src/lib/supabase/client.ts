"use client";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

export function browserClient() {
  const env = supabaseEnv();
  if (!env) throw new Error("Faltan las variables de Supabase.");
  return createBrowserClient(env.url, env.key);
}
