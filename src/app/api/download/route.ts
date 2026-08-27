import { NextResponse, type NextRequest } from "next/server";
import { resolveStoredMedia } from "@/lib/media-catalog";

/**
 * Sert un média du catalogue en pièce jointe.
 *
 * Le navigateur ignore l'attribut `download` d'un lien qui pointe vers un autre
 * domaine : il navigue vers le fichier au lieu de l'enregistrer. Or les médias
 * sont servis depuis un miroir R2, donc bien ailleurs que le site — et ce
 * miroir ne renvoie aucun en-tête CORS, ce qui interdit aussi de le récupérer
 * en `fetch()` pour le transformer en blob.
 *
 * Le fichier transite donc par notre origine, avec un `Content-Disposition` qui
 * en fait explicitement un téléchargement, nom de fichier compris.
 *
 * On ne reçoit qu'un CHEMIN, jamais une adresse : l'hôte est reconstruit ici à
 * partir du miroir configuré. Accepter une URL complète ferait de cette route
 * un relais vers n'importe quel serveur, au nom du nôtre.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("path");
  if (!raw) return NextResponse.json({ error: "Paramètre `path` manquant." }, { status: 400 });

  // Le chemin doit rester à l'intérieur du catalogue : ni remontée (`..`), ni
  // adresse absolue, ni protocole. Ce qui reste est un chemin relatif simple.
  const path = raw.replace(/^\/+/, "");
  if (path.includes("..") || path.includes("//") || /^[a-z][a-z0-9+.-]*:/i.test(path)) {
    return NextResponse.json({ error: "Chemin invalide." }, { status: 400 });
  }

  const target = resolveStoredMedia(`/media/${path}`);
  if (!target) return NextResponse.json({ error: "Chemin invalide." }, { status: 400 });
  // Miroir non configuré : les fichiers sont servis localement depuis
  // `public/media`, il faut donc une adresse absolue vers nous-mêmes.
  const url = target.startsWith("/") ? new URL(target, request.nextUrl.origin).toString() : target;

  const upstream = await fetch(url).catch(() => null);
  if (!upstream?.ok) {
    return NextResponse.json({ error: "Média introuvable." }, { status: upstream?.status ?? 502 });
  }

  const name = path.split("/").pop() || "media";
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      // `filename*` en plus de `filename` : les noms du catalogue contiennent
      // des espaces et des accents, qu'un `filename` seul rend mal.
      "Content-Disposition": `attachment; filename="${name.replace(/["\\]/g, "")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      // Immuable : un média du catalogue ne change jamais de contenu à chemin
      // constant, un nouveau fichier reçoit un nouveau nom.
      "Cache-Control": "public, max-age=31536000, immutable",
      ...(upstream.headers.get("content-length")
        ? { "Content-Length": upstream.headers.get("content-length")! }
        : {}),
    },
  });
}
