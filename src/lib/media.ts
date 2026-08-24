import type { LocationWiki } from "@/types";
import { FRAMES_BASE_URL, GTADB_PHOTOS_ORIGIN, PHOTOS_BASE_URL, WIKI_IMAGES_BASE_URL } from "./map/config";

/**
 * Résolution des URLs d'images.
 *
 * Les données générées (`src/data/generated/*.json`) ne stockent qu'un nom de
 * fichier : le miroir (`public/photos`, bucket R2…) n'est qu'un cache. Les
 * dossiers d'assets étant ignorés par git, un déploiement sans variable
 * `NEXT_PUBLIC_*_BASE_URL` n'a aucun fichier à servir — on repart alors de la
 * source publique d'origine plutôt que de pointer un `/photos/…` inexistant.
 *
 * Les frames de trailers font exception : extraites d'une archive de 1,5 Go
 * (`npm run fetch:frames`), elles n'ont pas d'URL publique unitaire et doivent
 * être hébergées (`npm run assets:upload` + `NEXT_PUBLIC_FRAMES_BASE_URL`).
 */

function isAbsolute(file: string): boolean {
  return /^https?:\/\//.test(file);
}

/**
 * Photo gtadb (`gtadb/L1478-ig.jpg`) : miroir si configuré, sinon
 * `https://map.gtadb.org/photos/6/L1478,ig.jpg`.
 */
export function photoUrl(file: string | null | undefined): string | null {
  if (!file) return null;
  if (isAbsolute(file)) return file;
  if (PHOTOS_BASE_URL) return `${PHOTOS_BASE_URL}/${file}`;
  const match = /^gtadb\/(.+)-(ig|rl)\.jpg$/.exec(file);
  return match ? `${GTADB_PHOTOS_ORIGIN}/${match[1]},${match[2]}.jpg` : null;
}

/** Frame de trailer / screenshot : uniquement depuis un miroir (aucune source unitaire publique). */
export function frameUrl(file: string | null | undefined): string | null {
  if (!file) return null;
  if (isAbsolute(file)) return file;
  return FRAMES_BASE_URL ? `${FRAMES_BASE_URL}/${file}` : null;
}

/** Image d'une fiche wiki : vignette miroir si configurée, sinon la vignette gta.wiki d'origine. */
export function wikiImageUrl(wiki: LocationWiki | null | undefined): string | null {
  if (!wiki) return null;
  const { image, imageUrl } = wiki;
  if (image && isAbsolute(image)) return image;
  if (image && WIKI_IMAGES_BASE_URL) return `${WIKI_IMAGES_BASE_URL}/${image}`;
  return imageUrl ?? null;
}
