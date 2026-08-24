import { NextResponse, type NextRequest } from "next/server";
import { getLocations } from "@/lib/data/locations";
import { LocationSearchIndex } from "@/lib/search";

export const revalidate = 3600;

/**
 * GET /api/locations
 *   ?q=texte        recherche (max 20 résultats)
 *   ?category=slug  filtre catégorie
 *   ?bbox=xMin,yMin,xMax,yMax  filtre spatial (mètres monde)
 *   ?fields=marker  payload réduit (id, slug, name, categorySlug, latLng, color)
 *
 * Utilisé par les intégrations externes / second écran ; l'app elle-même reçoit
 * les données via Server Components.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";
  const category = searchParams.get("category");
  const bbox = searchParams.get("bbox")?.split(",").map(Number);
  const fields = searchParams.get("fields");

  let locations = await getLocations();

  if (q) {
    const index = new LocationSearchIndex(locations);
    locations = index.search(q, 20).map((r) => r.location);
  }
  if (category) locations = locations.filter((l) => l.categorySlug === category);
  if (bbox && bbox.length === 4 && bbox.every((n) => Number.isFinite(n))) {
    const [xMin, yMin, xMax, yMax] = bbox;
    locations = locations.filter((l) => l.x >= xMin && l.x <= xMax && l.y >= yMin && l.y <= yMax);
  }

  const payload =
    fields === "marker"
      ? locations.map(({ id, slug, name, kind, categorySlug, latLng, color }) => ({ id, slug, name, kind, categorySlug, latLng, color }))
      : locations;

  return NextResponse.json(
    { count: payload.length, data: payload },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
