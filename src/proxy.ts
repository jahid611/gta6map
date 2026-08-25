import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Proxy Next 16 (ex-middleware) : rafraîchit la session Supabase sur chaque
 * navigation pour que les cookies d'auth restent valides côté serveur
 * (Server Components, Route Handlers). Inerte si Supabase n'est pas configuré.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Ne pas retirer : c'est cet appel qui rafraîchit le jeton expiré.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Tout sauf les assets statiques (tuiles, photos, frames, images Next…).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|tiles|photos|frames|wiki|brand|media|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|mp4|webm)$).*)"],
};
