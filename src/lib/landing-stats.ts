import "server-only";

import { cache } from "react";
import type { Location, MapSection } from "@/types";
import { getAreas, getCategories, getLocations, getSections } from "@/lib/data/locations";
import { frameUrl, wikiImageUrl } from "@/lib/media";
import { MEDIA_CATALOG } from "@/lib/media-catalog";
import { normalizeText } from "@/lib/utils";
import regionCovers from "@/data/generated/region-covers.json";

/** Une région de la landing : section de carte + ses compteurs dérivés. */
export interface LandingRegion {
  slug: string;
  name: string;
  /** Extrait GTA Wiki, tronqué pour la carte de présentation. */
  blurb: string | null;
  count: number;
  /** Zones/quartiers rattachés, les plus fournis d'abord. */
  districts: string[];
  /** Illustration de fond : plan officiel tourné dans la région, à défaut la
   *  vignette GTA Wiki. `null` si ni l'un ni l'autre n'est disponible. */
  image: string | null;
}

/** Un plan officiel géolocalisé, tel qu'affiché dans la galerie de la landing. */
export interface ShowcaseShot {
  slug: string;
  name: string;
  area: string | null;
  /** Frame 1600 px, ou `null` si aucun miroir de frames n'est configuré.
   *  On sert la pleine résolution et non la vignette 480 px : les cartes font
   *  jusqu'à 480 px de large en 2x, la vignette y était visiblement molle.
   *  `next/image` se charge de produire les tailles intermédiaires. */
  image: string | null;
  sourceLabel: string;
}

export interface LandingStats {
  total: number;
  landmarks: number;
  cameras: number;
  categories: number;
  photos: number;
  regions: LandingRegion[];
  /** Sélection de plans pour la galerie — vide si les frames ne sont pas servies. */
  showcase: ShowcaseShot[];
  /** Répartition des plans officiels par source (« Trailer 1 », « Screenshot officiel »…). */
  mediaSources: { label: string; count: number }[];
}

/** Un point est-il dans les bornes `[xMin, yMin, xMax, yMax]` d'une section ? */
function isInside(x: number, y: number, [xMin, yMin, xMax, yMax]: MapSection["bounds"]): boolean {
  return x >= xMin && x <= xMax && y >= yMin && y <= yMax;
}

function boxArea([xMin, yMin, xMax, yMax]: MapSection["bounds"]): number {
  return (xMax - xMin) * (yMax - yMin);
}

/**
 * Rattache un point a UNE seule section.
 *
 * Les bornes des sections se chevauchent largement (la boite « Vice City » fait
 * 56 km2 et englobe une partie de ses voisines), donc un simple test
 * d'inclusion comptait certains lieux deux ou trois fois : la somme des regions
 * depassait le total. On retient la plus petite boite contenante, ce qui donne
 * une partition exclusive dont la somme retombe exactement sur le nombre de
 * lieux (1 point du jeu de donnees actuel ne tombe dans aucune section).
 */
function sectionFor(x: number, y: number, sections: readonly MapSection[]): MapSection | null {
  let best: MapSection | null = null;
  for (const section of sections) {
    if (!isInside(x, y, section.bounds)) continue;
    if (!best || boxArea(section.bounds) < boxArea(best.bounds)) best = section;
  }
  return best;
}

/**
 * Présentations des régions, en français.
 *
 * Les extraits de GTA Wiki sont en anglais et se limitent à « X is a county due
 * to appear in Grand Theft Auto VI » — sur un site francophone, c'était à la
 * fois une faute de langue et une phrase sans contenu. Ces textes reprennent les
 * faits du wiki (rattachement administratif, nature du lieu) en les rendant
 * lisibles.
 */
const REGION_BLURBS: Readonly<Record<string, string>> = {
  "vice-city": "La grande ville de l'État, chef-lieu du comté de Vice-Dale : néons, tours de verre et front de mer. C'est là que se concentre l'essentiel des lieux relevés.",
  "leonida-keys": "Un archipel au sud du comté de Mariana, égrené le long de la route qui saute d'un îlot à l'autre jusqu'au bout de l'État.",
  grassrivers: "Une région naturelle de prairies inondées — les marais de Leonida, à l'ouest de Vice City.",
  "mariana-county": "Le comté du sud de l'État : côtes basses, mangroves et petites villes, jusqu'aux Leonida Keys.",
  "port-gellhorn": "Ville portuaire du comté de Kelly, sur la côte nord-ouest : docks, entrepôts et front de mer.",
  ambrosia: "Ville du comté d'Ambrosia, au cœur des terres agricoles du centre de Leonida.",
  "leonard-county": "Le comté du sud-est, entre champs, bourgs et routes rectilignes.",
  "mount-kalaga-national-park": "Le parc national du comté de Lummox : reliefs boisés, lacs et pistes de terre.",
};

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  // Coupe sur la dernière fin de phrase, à défaut sur le dernier espace.
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(" "));
  return `${cut.slice(0, stop > max * 0.5 ? stop : max).trimEnd()}…`;
}

/**
 * Agrégats affichés sur la landing. Tout est calculé à partir des mêmes sources
 * que la carte (`getLocations` & co.) : aucun chiffre n'est écrit en dur, ils
 * suivent donc automatiquement le seed.
 *
 * `cache()` déduplique l'appel entre la page et son `generateMetadata`.
 */
export const getLandingStats = cache(async (): Promise<LandingStats> => {
  const [locations, categories, sections, areas] = await Promise.all([
    getLocations(),
    getCategories(),
    getSections(),
    getAreas(),
  ]);

  const cameras = locations.filter((l) => l.kind === "camera");

  const mediaCounts = new Map<string, number>();
  for (const l of cameras) {
    const label = l.media?.sourceLabel;
    if (label) mediaCounts.set(label, (mediaCounts.get(label) ?? 0) + 1);
  }

  const sectionByName = new Map(sections.map((s) => [s.name, s]));

  // Rattachement explicite des quartiers, lu dans les chaines `area` des lieux
  // (« Stockyard, Vice City »). Il PRIME sur la geometrie : les boites de
  // sections se chevauchent, et la plus petite boite contenante rangeait par
  // exemple Stockyard et La Perle sous Ambrosia alors que la donnee les dit a
  // Vice City. La geometrie ne sert plus que de repli, pour les zones dont
  // aucun lieu ne nomme la region parente.
  const sectionByDistrict = new Map<string, MapSection>();
  for (const l of locations) {
    const parts = (l.area ?? "").split(", ");
    if (parts.length !== 2) continue;
    const parent = sectionByName.get(parts[1]);
    if (parent) sectionByDistrict.set(parts[0], parent);
  }

  /** Region d'un lieu : sa zone declaree si elle en designe une, sinon sa position. */
  function sectionOf(area: string | null | undefined, x: number, y: number): MapSection | null {
    const parts = (area ?? "").split(", ");
    for (let i = parts.length - 1; i >= 0; i--) {
      const named = sectionByName.get(parts[i]);
      if (named) return named;
    }
    return sectionByDistrict.get(parts[0]) ?? sectionFor(x, y, sections);
  }

  // On ne compte que les LIEUX, pas les positions de caméras : sans cela, la
  // somme des huit régions donnait 1 540 quand le bandeau de chiffres et la carte
  // annoncent 1 439 lieux et 101 plans — deux mesures différentes présentées
  // comme la même.
  const countBySection = new Map<string, number>();
  for (const l of locations) {
    if (l.kind !== "landmark") continue;
    const section = sectionOf(l.area, l.x, l.y);
    if (section) countBySection.set(section.slug, (countBySection.get(section.slug) ?? 0) + 1);
  }

  // Quartiers mis en avant : les plus fournis d'abord, rattaches par la meme
  // regle que les lieux pour rester coherent avec les compteurs affiches.
  const districtsBySection = new Map<string, string[]>();
  for (const a of [...areas].sort((x, y) => y.count - x.count)) {
    const section = sectionOf(a.name, a.x, a.y);
    if (!section || a.name === section.name) continue;
    const list = districtsBySection.get(section.slug) ?? [];
    if (list.length < 4) list.push(a.name);
    districtsBySection.set(section.slug, list);
  }

  // Illustration de région : on privilégie un plan officiel tourné sur place —
  // c'est de l'imagerie in-game, autrement plus parlante qu'une vignette wiki.
  // Trois régions n'ont aucune caméra référencée, d'où le repli sur le wiki.
  const camerasBySection = new Map<string, Location[]>();
  for (const c of cameras) {
    const section = sectionOf(c.area, c.x, c.y);
    if (!section || !frameUrl(c.media?.thumb)) continue;
    camerasBySection.set(section.slug, [...(camerasBySection.get(section.slug) ?? []), c]);
  }

  /**
   * Illustration d'une région, par ordre de qualité :
   *  1. la carte postale officielle du dossier `artwork/Postcards` (six régions) ;
   *  2. à défaut un screenshot officiel « Places » de la région — de l'imagerie
   *     in-game en pleine résolution ;
   *  3. à défaut la vue aérienne composée depuis les tuiles (`npm run build:region-covers`) :
   *     les deux régions concernées n'ont aucune imagerie officielle, et les rares
   *     plans de trailers qui s'y trouvent montrent un intérieur de voiture ou une
   *     autre région ;
   *  4. à défaut un plan de trailer tourné sur place ;
   *  5. la vignette wiki en dernier recours (souvent un simple panneau routier).
   */
  const key = (s: string) => normalizeText(s).replace(/[^a-z0-9]+/g, " ").trim();
  // Les cartes de région sont presque carrées (384 × 416) : on prend la variante
  // carrée de la carte postale plutôt que le paysage 16:9, qui perdait la moitié
  // de l'image au recadrage.
  const postcards = new Map(
    MEDIA_CATALOG.filter((e) => e.group === "Postcards").map((e) => [
      key(e.title),
      e.variants.find((v) => /_square\.(jpe?g|png|webp)$/i.test(v)) ?? e.src,
    ]),
  );
  const placeShots = new Map<string, string>();
  for (const e of MEDIA_CATALOG) {
    if (e.kind !== "screenshot" || e.section !== "Places") continue;
    if (!placeShots.has(key(e.group))) placeShots.set(key(e.group), e.src);
  }

  function regionImage(section: MapSection): string | null {
    const k = key(section.name);
    const official = postcards.get(k) ?? placeShots.get(k) ?? (regionCovers as Record<string, string>)[section.slug];
    if (official) return official;
    const shots = camerasBySection.get(section.slug) ?? [];
    // Un plan qui porte le nom de la région la représente mieux qu'un plan
    // quelconque qui s'y trouve (un intérieur de voiture, par exemple).
    const named = shots.find((s) => s.name.startsWith(section.name));
    const chosen = named ?? shots[0];
    return chosen ? frameUrl(chosen.media?.frame) : wikiImageUrl(section.wiki);
  }

  const regions: LandingRegion[] = sections
    .map((section) => ({
      slug: section.slug,
      name: section.name,
      blurb: REGION_BLURBS[section.slug] ?? (section.wiki?.extract ? truncate(section.wiki.extract, 190) : null),
      count: countBySection.get(section.slug) ?? 0,
      districts: districtsBySection.get(section.slug) ?? [],
      image: regionImage(section),
    }))
    .sort((a, b) => b.count - a.count);

  // Galerie : on alterne les sources (Trailer 1 / Trailer 2 / Screenshot) plutôt
  // que de prendre les 24 premiers, sinon la bande n'affiche qu'un seul trailer.
  const bySource = new Map<string, Location[]>();
  for (const c of cameras) {
    const key = c.media?.sourceLabel;
    if (!key || !frameUrl(c.media?.frame)) continue;
    bySource.set(key, [...(bySource.get(key) ?? []), c]);
  }
  const showcase: ShowcaseShot[] = [];
  for (let i = 0; showcase.length < 24; i++) {
    const before = showcase.length;
    for (const list of bySource.values()) {
      const c = list[i];
      if (!c || showcase.length >= 24) continue;
      showcase.push({
        slug: c.slug,
        name: c.name,
        area: c.area ?? null,
        image: frameUrl(c.media?.frame),
        sourceLabel: c.media?.sourceLabel ?? "",
      });
    }
    if (showcase.length === before) break; // toutes les listes épuisées
  }

  return {
    total: locations.length,
    showcase,
    landmarks: locations.length - cameras.length,
    cameras: cameras.length,
    // Toutes les catégories réellement présentes sur la carte — c'est ce que
    // compte le panneau de filtres. Ne retenir que les « suivables » affichait 21
    // à l'accueil quand la carte en proposait 24.
    categories: categories.length,
    photos: locations.filter((l) => l.photos?.ig || l.photos?.irl).length,
    regions,
    mediaSources: [...mediaCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
  };
});
