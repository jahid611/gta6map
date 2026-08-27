/* eslint-disable no-console */
/**
 * Enrichissement depuis gta.wiki (MediaWiki, licence CC BY-NC-SA 3.0) :
 *  - toutes les pages des catégories « Locations in GTA VI in … » (zones de Leonida)
 *  - + pages de zones (State of Leonida, Vice City, Port Gellhorn…)
 *  - pour chaque page : URL, extrait d'intro, image principale (vignette 1024 px)
 *
 * Sorties : data/raw/wiki-places.json, public/wiki/{slug}.jpg (vignettes)
 * Usage : npm run fetch:wiki [-- --no-images]
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { slugify } from "../src/lib/utils";

const ROOT = path.resolve(__dirname, "..");
const OUT_JSON = path.join(ROOT, "data", "raw", "wiki-places.json");
const IMG_DIR = path.join(ROOT, "public", "wiki");
const API = "https://gta.wiki/api.php";
const UA = "gta6map-fetch/1.0 (fan map; contact via GitHub)";
const SKIP_IMAGES = process.argv.includes("--no-images");

const LOCATION_CATEGORIES = [
  "Locations in GTA VI in Vice City",
  "Locations in GTA VI in Vice Beach",
  "Locations in GTA VI in Vice-Dale County",
  "Locations in GTA VI in Kelly County",
  "Locations in GTA VI in Leonard County",
  "Locations in GTA VI in Mariana County",
  "Locations in GTA VI in Ambrosia County",
  "Locations in GTA VI in Ambrosia",
  "Locations in GTA VI in Leonida",
];

const AREA_PAGES = [
  "State of Leonida",
  "Vice City (HD Universe)",
  "Vice Beach",
  "Port Gellhorn",
  "Leonida Keys",
  "Grassrivers",
  "Ambrosia (town)",
  "Ambrosia County",
  "Mount Kalaga National Park",
  "Kelly County",
  "Leonard County",
  "Mariana County",
  "Vice-Dale County",
  "Hamlet",
  "Watson Bay",
  "Key Lento",
  "Tequesta Key",
  "Waning Sands",
  "Port Vice City",
  "Vice City International Airport",
];

export interface WikiPlace {
  pageId: number;
  title: string;
  slug: string;
  url: string;
  /** Zone déduite de la catégorie (ou "area" pour les pages de zones). */
  area: string | null;
  kind: "location" | "area";
  extract: string | null;
  image: { thumb: string; original: string; width: number; height: number; local: string | null } | null;
}

async function api<T>(params: Record<string, string>): Promise<T> {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

interface CategoryMembersResponse {
  continue?: { cmcontinue: string };
  query: { categorymembers: { pageid: number; ns: number; title: string }[] };
}

async function categoryMembers(category: string): Promise<string[]> {
  const titles: string[] = [];
  let cmcontinue: string | undefined;
  do {
    const res = await api<CategoryMembersResponse>({
      action: "query",
      list: "categorymembers",
      cmtitle: `Category:${category}`,
      cmlimit: "500",
      cmnamespace: "0",
      ...(cmcontinue ? { cmcontinue } : {}),
    });
    titles.push(...res.query.categorymembers.map((m) => m.title));
    cmcontinue = res.continue?.cmcontinue;
  } while (cmcontinue);
  return titles;
}

interface PagesResponse {
  query: {
    pages: {
      pageid: number;
      title: string;
      missing?: boolean;
      fullurl?: string;
      extract?: string;
      thumbnail?: { source: string; width: number; height: number };
      original?: { source: string; width: number; height: number };
    }[];
  };
}

async function pageDetails(titles: string[]): Promise<PagesResponse["query"]["pages"]> {
  const out: PagesResponse["query"]["pages"] = [];
  // Lots de 20 et non de 50 : `TextExtracts` plafonne `exlimit` à 20 et se
  // contente d'un avertissement quand on demande plus — les pages au-delà du
  // vingtième titre revenaient sans extrait, silencieusement. C'est ce qui
  // laissait six zones sur dix-sept avec une fiche réduite à son titre.
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20);
    const res = await api<PagesResponse>({
      action: "query",
      titles: batch.join("|"),
      prop: "pageimages|extracts|info",
      inprop: "url",
      exintro: "1",
      explaintext: "1",
      exlimit: "20",
      piprop: "thumbnail|original",
      pithumbsize: "1024",
      redirects: "1",
    });
    out.push(...res.query.pages.filter((p) => !p.missing));
  }
  return out;
}

async function downloadImage(url: string, dest: string): Promise<boolean> {
  if (existsSync(dest)) return true;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return false;
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return true;
}

async function main(): Promise<void> {
  mkdirSync(IMG_DIR, { recursive: true });
  const titleArea = new Map<string, string>();
  for (const cat of LOCATION_CATEGORIES) {
    const area = cat.replace("Locations in GTA VI in ", "");
    const members = await categoryMembers(cat);
    console.log(`  ${cat}: ${members.length} pages`);
    for (const t of members) if (!titleArea.has(t)) titleArea.set(t, area);
  }
  const locationTitles = [...titleArea.keys()].filter((t) => !t.startsWith("Category:"));
  console.log(`▶ ${locationTitles.length} pages de lieux + ${AREA_PAGES.length} pages de zones`);

  const [locPages, areaPages] = await Promise.all([pageDetails(locationTitles), pageDetails(AREA_PAGES)]);

  const places: WikiPlace[] = [];
  const build = (p: PagesResponse["query"]["pages"][number], kind: "location" | "area"): WikiPlace => ({
    pageId: p.pageid,
    title: p.title,
    slug: slugify(p.title),
    url: p.fullurl ?? `https://gta.wiki/w/${encodeURIComponent(p.title.replace(/ /g, "_"))}`,
    area: kind === "area" ? null : (titleArea.get(p.title) ?? null),
    kind,
    extract: p.extract?.trim() || null,
    image: p.thumbnail
      ? {
          thumb: p.thumbnail.source,
          original: p.original?.source ?? p.thumbnail.source,
          width: p.thumbnail.width,
          height: p.thumbnail.height,
          local: null,
        }
      : null,
  });
  for (const p of locPages) places.push(build(p, "location"));
  for (const p of areaPages) places.push(build(p, "area"));

  if (!SKIP_IMAGES) {
    let n = 0;
    for (const place of places) {
      if (!place.image) continue;
      const ext = /\.(png|jpe?g|webp)/i.exec(place.image.thumb)?.[1]?.toLowerCase() ?? "jpg";
      const file = `${place.slug}.${ext === "jpeg" ? "jpg" : ext}`;
      try {
        if (await downloadImage(place.image.thumb, path.join(IMG_DIR, file))) {
          place.image.local = file;
          n += 1;
        }
      } catch (err) {
        console.warn(`  ⚠ ${place.title}: ${err instanceof Error ? err.message : err}`);
      }
    }
    console.log(`  ✓ ${n} images dans public/wiki`);
  }

  writeFileSync(OUT_JSON, JSON.stringify(places, null, 2));
  console.log(`✓ ${places.length} pages → data/raw/wiki-places.json`);
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
