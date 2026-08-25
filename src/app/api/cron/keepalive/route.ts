import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/keepalive — appelé chaque jour par le cron Vercel (`vercel.json`).
 *
 * Les projets Supabase gratuits sont mis en pause après 7 jours sans activité :
 * une lecture REST et un ping Auth suffisent à maintenir le projet actif.
 * Si `CRON_SECRET` est défini sur Vercel, l'appel doit porter
 * `Authorization: Bearer <CRON_SECRET>` (Vercel l'ajoute automatiquement).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 200 });

  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const started = Date.now();
  const checks = await Promise.all([
    fetch(`${url}/rest/v1/categories?select=slug&limit=1`, { headers, cache: "no-store" })
      .then((r) => ({ rest: r.status }))
      .catch((e: Error) => ({ rest: `error: ${e.message}` })),
    fetch(`${url}/auth/v1/health`, { headers, cache: "no-store" })
      .then((r) => ({ auth: r.status }))
      .catch((e: Error) => ({ auth: `error: ${e.message}` })),
  ]);
  const result = Object.assign({}, ...checks) as { rest: number | string; auth: number | string };
  const ok = result.rest === 200;

  return NextResponse.json(
    { ok, ...result, ms: Date.now() - started, at: new Date().toISOString() },
    { status: ok ? 200 : 502, headers: { "Cache-Control": "no-store" } },
  );
}
