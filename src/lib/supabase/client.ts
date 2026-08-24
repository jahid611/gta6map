"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client non générique : les lignes sont typées explicitement à la lecture via
 * `database.types.ts` (évite la dérive entre le générateur supabase et la version du SDK).
 */
export type AppSupabaseClient = SupabaseClient;

let browserClient: AppSupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

/**
 * Client Supabase côté navigateur (singleton). Retourne `null` si les variables
 * d'environnement ne sont pas définies : l'app fonctionne alors en mode
 * « local uniquement » (JSON statique + localStorage).
 */
export function getSupabaseBrowserClient(): AppSupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return browserClient;
}
