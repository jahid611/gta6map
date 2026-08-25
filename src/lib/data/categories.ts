import type { Category, CategoryGroup } from "@/types/category";

/**
 * Définition canonique des catégories. Source de vérité partagée par le seed
 * (table `categories`), le fallback statique et le mapping tags → catégorie.
 *
 * Groupes :
 *  - `media`    : images officielles géolocalisées (trailers, screenshots Rockstar)
 *  - `gameplay` : contenu de jeu — pré-créé, alimenté à la sortie du jeu
 *  - `landmark` : lieux identifiés par la communauté (gtadb.org)
 */
export const CATEGORY_DEFINITIONS: readonly Category[] = [
  // ───────────────── Médias officiels ─────────────────
  { slug: "trailer-1", name: "Trailer 1", description: "Plans du premier trailer (déc. 2023), position caméra triangulée.", group: "media", icon: "Clapperboard", color: "#f976b0", sortOrder: 1, trackable: false },
  { slug: "trailer-2", name: "Trailer 2", description: "Plans du second trailer (mai 2025), position caméra triangulée.", group: "media", icon: "Film", color: "#eb4c93", sortOrder: 2, trackable: false },
  { slug: "screenshots", name: "Screenshots", description: "Screenshots officiels Rockstar géolocalisés.", group: "media", icon: "Camera", color: "#8cdbf3", sortOrder: 3, trackable: false },
  // ───────────────── Gameplay ─────────────────
  { slug: "collectibles", name: "Collectibles", description: "Objets à collectionner dispersés dans Leonida.", group: "gameplay", icon: "Gem", color: "#f59e0b", sortOrder: 10, trackable: true },
  { slug: "vehicles", name: "Véhicules", description: "Véhicules uniques, rares ou à spawn fixe.", group: "gameplay", icon: "Car", color: "#3b82f6", sortOrder: 20, trackable: true },
  { slug: "weapons", name: "Armes", description: "Armes et munitions à récupérer sur la carte.", group: "gameplay", icon: "Crosshair", color: "#e50914", sortOrder: 30, trackable: true },
  { slug: "missions", name: "Missions", description: "Points de départ des missions principales et secondaires.", group: "gameplay", icon: "Flag", color: "#a855f7", sortOrder: 40, trackable: true },
  { slug: "easter-eggs", name: "Easter eggs", description: "Secrets, références et clins d'œil cachés.", group: "gameplay", icon: "Egg", color: "#ec4899", sortOrder: 50, trackable: true },
  // ───────────────── Landmarks ─────────────────
  { slug: "landmark", name: "Landmarks", description: "Monuments et lieux emblématiques.", group: "landmark", icon: "Star", color: "#ffd166", sortOrder: 100, trackable: true },
  { slug: "hotel", name: "Hôtels", description: "Hôtels et resorts identifiés.", group: "landmark", icon: "Hotel", color: "#f97316", sortOrder: 110, trackable: true },
  { slug: "residential", name: "Résidentiel", description: "Tours et immeubles d'habitation.", group: "landmark", icon: "Building2", color: "#22c55e", sortOrder: 120, trackable: true },
  { slug: "commercial", name: "Commerces & bureaux", description: "Boutiques, centres commerciaux, bureaux.", group: "landmark", icon: "Store", color: "#06b6d4", sortOrder: 130, trackable: true },
  { slug: "restaurant", name: "Restaurants & bars", description: "Restaurants, diners, bars, clubs.", group: "landmark", icon: "Utensils", color: "#fb7185", sortOrder: 140, trackable: true },
  { slug: "leisure", name: "Loisirs", description: "Plages aménagées, marinas, golf, parcs d'attractions.", group: "landmark", icon: "Palmtree", color: "#2dd4bf", sortOrder: 150, trackable: true },
  { slug: "entertainment", name: "Divertissement", description: "Stades, salles de concert, casinos.", group: "landmark", icon: "PartyPopper", color: "#d946ef", sortOrder: 160, trackable: true },
  { slug: "government", name: "Institutions", description: "Bâtiments publics, gouvernementaux, prisons.", group: "landmark", icon: "Landmark", color: "#94a3b8", sortOrder: 170, trackable: true },
  { slug: "industrial", name: "Industrie", description: "Usines, centrales, zones industrielles, chantiers.", group: "landmark", icon: "Factory", color: "#a8a29e", sortOrder: 180, trackable: true },
  { slug: "infrastructure", name: "Infrastructures", description: "Ponts, tours radio, stations d'épuration.", group: "landmark", icon: "Road", color: "#0ea5e9", sortOrder: 190, trackable: true },
  { slug: "transport", name: "Transports", description: "Aéroports, gares, ports, métro.", group: "landmark", icon: "Plane", color: "#eab308", sortOrder: 200, trackable: true },
  { slug: "public", name: "Espaces publics", description: "Parcs, places, espaces urbains.", group: "landmark", icon: "TreePine", color: "#84cc16", sortOrder: 210, trackable: true },
  { slug: "service", name: "Services", description: "Stations-service, garages, services de proximité.", group: "landmark", icon: "Fuel", color: "#14b8a6", sortOrder: 220, trackable: true },
  { slug: "nature", name: "Nature", description: "Sites naturels, marais, plages sauvages.", group: "landmark", icon: "Mountain", color: "#16a34a", sortOrder: 230, trackable: true },
  { slug: "safehouse", name: "Planques", description: "Planques et logements des protagonistes.", group: "landmark", icon: "Home", color: "#f43f5e", sortOrder: 240, trackable: true },
  { slug: "other", name: "Autres lieux", description: "Lieux identifiés sans classification précise.", group: "landmark", icon: "MapPin", color: "#7c8494", sortOrder: 250, trackable: true },
];

export const CATEGORY_BY_SLUG: ReadonlyMap<string, Category> = new Map(CATEGORY_DEFINITIONS.map((c) => [c.slug, c]));

export const CATEGORY_GROUP_LABELS: Readonly<Record<CategoryGroup, string>> = {
  media: "Trailers & screenshots",
  gameplay: "Gameplay",
  landmark: "Lieux & landmarks",
};

export const CATEGORY_GROUP_ORDER: readonly CategoryGroup[] = ["media", "gameplay", "landmark"];

/** Mapping tag source (gtadb / gta6map) → slug de catégorie. */
const TAG_TO_CATEGORY: Readonly<Record<string, string>> = {
  landmark: "landmark",
  "point-of-interest": "landmark",
  hotel: "hotel",
  residential: "residential",
  redisential: "residential",
  commercial: "commercial",
  retail: "commercial",
  office: "commercial",
  restaurant: "restaurant",
  leisure: "leisure",
  entertainment: "entertainment",
  events: "entertainment",
  government: "government",
  industrial: "industrial",
  industry: "industrial",
  construction: "industrial",
  infrastructure: "infrastructure",
  infr: "infrastructure",
  transport: "transport",
  transportation: "transport",
  public: "public",
  service: "service",
  nature: "nature",
  natural: "nature",
  agriculture: "nature",
  monument: "landmark",
  safehouse: "safehouse",
};

/** Priorité quand un lieu porte plusieurs tags (le premier trouvé gagne). */
const TAG_PRIORITY: readonly string[] = [
  "safehouse",
  "landmark",
  "transport",
  "government",
  "entertainment",
  "hotel",
  "restaurant",
  "leisure",
  "industrial",
  "infrastructure",
  "commercial",
  "residential",
  "public",
  "service",
  "nature",
];

/** Tags qui ne sont pas des catégories mais des drapeaux éditoriaux. */
export const FLAG_TAGS: ReadonlySet<string> = new Set([
  "unconfirmed",
  "uncomfirmed",
  "demolished",
  "may-not-exist",
  "address-ambiguous",
  "reused",
  "maybe-reused",
  "fictional",
  "cancelled",
  "2022",
  "2002",
  "make-more-specific-later",
]);

export const FLAG_LABELS: Readonly<Record<string, string>> = {
  unconfirmed: "Non confirmé",
  uncomfirmed: "Non confirmé",
  demolished: "Démoli IRL",
  "may-not-exist": "Existence incertaine",
  "address-ambiguous": "Adresse ambiguë",
  reused: "Asset réutilisé",
  "maybe-reused": "Asset peut-être réutilisé",
  fictional: "Fictif",
  cancelled: "Annulé",
  "2022": "Vu en 2022",
};

export function categoryFromTags(tags: readonly string[]): string {
  const mapped = tags.map((t) => TAG_TO_CATEGORY[t.toLowerCase()]).filter(Boolean);
  for (const slug of TAG_PRIORITY) if (mapped.includes(slug)) return slug;
  return mapped[0] ?? DEFAULT_CATEGORY_SLUG;
}

export function flagsFromTags(tags: readonly string[]): string[] {
  return tags.filter((t) => FLAG_TAGS.has(t.toLowerCase())).map((t) => (t === "uncomfirmed" ? "unconfirmed" : t));
}

/** `true` si le lieu doit être ignoré (doublon marqué dans la source). */
export function isDuplicateTagged(tags: readonly string[]): boolean {
  return tags.some((t) => /^duplicate-of-/i.test(t));
}

export const DEFAULT_CATEGORY_SLUG = "other";

export function categoryForCamera(group: string): string {
  if (group === "T1") return "trailer-1";
  if (group === "T2") return "trailer-2";
  return "screenshots";
}
