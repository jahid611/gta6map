import { NextResponse, type NextRequest } from "next/server";
import { photoUrl } from "@/lib/media";

export const revalidate = 86_400;

/**
 * GET /api/photo?f=gtadb/L1478-ig.jpg
 *
 * Relais des photos pour le mode piéton (`/street`).
 *
 * WebGL refuse toute texture d'une autre origine qui n'autorise pas
 * explicitement le partage : `map.gtadb.org` ne renvoie aucun en-tête CORS, et
 * les façades resteraient donc vides. Le relais rend l'image de notre propre
 * origine, où la question ne se pose plus. Le reste du site n'en a pas besoin —
 * une `<img>` se moque du CORS, c'est la texture qui l'exige.
 *
 * Ce n'est pas un relais ouvert : le paramètre est un **nom de fichier**, pas
 * une URL, et c'est `photoUrl()` qui décide de la source (miroir configuré ou
 * source d'origine). Aucun hôte arbitraire n'est joignable.
 */
export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("f");
  if (!file || file.includes("..") || /^https?:/i.test(file)) {
    return NextResponse.json({ error: "paramètre f invalide" }, { status: 400 });
  }

  const target = photoUrl(file);
  if (!target) return NextResponse.json({ error: "photo inconnue" }, { status: 404 });

  // Miroir local (`/photos/…`) : Next sert déjà le fichier depuis /public, et il
  // est de même origine. On y renvoie plutôt que de le relire nous-mêmes.
  if (target.startsWith("/")) return NextResponse.redirect(new URL(target, req.nextUrl.origin));

  const upstream = await fetch(target, {
    headers: { Accept: "image/*" },
    next: { revalidate: 86_400 },
  });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "source indisponible" }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
    },
  });
}
