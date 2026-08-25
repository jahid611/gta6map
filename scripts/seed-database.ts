/* eslint-disable no-console */
/**
 * Seed / migration des données cartographiques.
 *
 * Sources (voir `npm run fetch:all`) :
 *  1. data/raw/gtadb-landmarks.json   map.gtadb.org — ≈1 500 landmarks (ids `L…`), photos ig/rl
 *     Ligne : [igAddress, [x,y], [igW,igH]|[], rlAddress, [lat,lng], [rlW,rlH]|[], tags, color, [edited…]]
 *  2. data/raw/cameras.json           gtamaplib — caméras officielles trailers/screenshots (T1/T2/S2/S3)
 *  3. data/raw/wiki-places.json       gta.wiki — pages de lieux et de zones (extraits, images)
 *  4. data/raw/map-sections.json      gtamaplib — bbox des grandes zones
 *  5. data/raw/gtamaplib-landmarks3d.json — altitude / hauteur (enrichissement)
 *
 * Étapes : parse + normalisation → catégorie / drapeaux → enrichissement 3D + wiki →
 * JSON statiques (src/data/generated) → upsert Supabase si configuré.
 *
 * Usage : npm run seed [-- --no-db | --dry-run]
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

import {
  CATEGORY_DEFINITIONS,
  categoryForCamera,
  categoryFromTags,
  flagsFromTags,
  isDuplicateTagged,
} from "../src/lib/data/categories";
import { worldToLatLng } from "../src/lib/map/coords";
import { normalizeText, slugify } from "../src/lib/utils";
import type { AreaInfo, Category, ConfirmationStatus, Location, LocationWiki, MapSection } from "../src/types";
import type { CameraRecord } from "./fetch-sources";
import type { WikiPlace } from "./fetch-wiki";

loadEnv({ path: ".env.local" });
loadEnv();

const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "raw");
const OUT_DIR = path.join(ROOT, "src", "data", "generated");

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const SKIP_DB = args.has("--no-db") || DRY_RUN;

// ───────────────────────────── Types source ─────────────────────────────

type GtadbRow = [
  igAddress: string,
  igCoords: [number, number] | [],
  igPhotoSize: [number, number] | [],
  rlAddress: string,
  rlCoords: [number, number] | [],
  rlPhotoSize: [number, number] | [],
  tags: string[],
  color: string,
  edited: [number, number, number],
];

interface RawLandmark3D {
  name: string;
  id: string;
  xyz: [number, number, number];
  height: number;
}

// ───────────────────────────── Helpers ─────────────────────────────

function readJson<T>(file: string, fallback: T): T {
  const p = path.join(RAW_DIR, file);
  if (!existsSync(p)) {
    console.warn(`  ⚠ ${file} absent — lancer \`npm run fetch:all\``);
    return fallback;
  }
  return JSON.parse(readFileSync(p, "utf8")) as T;
}

/** UUID v5-like déterministe (sha1) → idempotence du seed, ids stables JSON ⇄ DB. */
function stableUuid(namespace: string, value: string): string {
  const hex = createHash("sha1").update(`${namespace}:${value}`).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0")}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

function parseInGameAddress(value: string): { name: string | null; area: string | null; status: ConfirmationStatus } {
  const parts = value.split(", ").map((p) => p.trim());
  const rawName = parts[0] ?? "";
  const area = parts.length > 1 ? parts.slice(1).join(", ") : null;
  if (rawName === "?" || rawName === "") return { name: null, area, status: "unknown" };
  if (rawName.endsWith("?")) return { name: rawName.slice(0, -1).trim(), area, status: "unconfirmed" };
  return { name: rawName, area, status: "confirmed" };
}

function parseRealWorldAddress(value: string): { name: string | null; address: string | null; status: ConfirmationStatus } {
  if (value === "?" || value === "") return { name: null, address: null, status: "unknown" };
  const status: ConfirmationStatus = value.endsWith("?") ? "unconfirmed" : "confirmed";
  const clean = value.replace(/\?$/, "").replace(/, USA$/, "").trim();
  const parts = clean.split(", ");
  return { name: parts[0] ?? null, address: parts.length > 1 ? parts.slice(1).join(", ") : null, status };
}

/** Clé de correspondance nom (sans suffixe « (X) », sans accents, sans « the »). */
function matchKey(name: string): string {
  return normalizeText(name.replace(/\s*\([^)]*\)\s*$/g, ""))
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// ───────────────────────────── Wiki ─────────────────────────────

function buildWikiIndex(places: WikiPlace[]): Map<string, WikiPlace> {
  const index = new Map<string, WikiPlace>();
  for (const p of places) {
    if (p.kind !== "location") continue;
    index.set(matchKey(p.title.replace(/\s*\(HD Universe\)$/, "")), p);
  }
  return index;
}

function toWiki(p: WikiPlace | undefined): LocationWiki | null {
  if (!p) return null;
  return {
    title: p.title,
    url: p.url,
    extract: p.extract ? p.extract.slice(0, 600) : null,
    // Nom dans le miroir + URL d'origine : l'app choisit selon la config (cf. src/lib/media.ts).
    image: p.image?.local ?? null,
    imageUrl: p.image?.thumb ?? null,
  };
}

// ───────────────────────────── Build ─────────────────────────────

interface SeedStats {
  total: number;
  landmarks: number;
  cameras: number;
  skippedNoCoords: number;
  skippedDuplicates: number;
  enriched3d: number;
  wikiMatches: number;
  photosIg: number;
  photosRl: number;
  byCategory: Record<string, number>;
}

function build(): { locations: Location[]; sections: MapSection[]; areas: AreaInfo[]; stats: SeedStats } {
  const gtadb = readJson<Record<string, GtadbRow>>("gtadb-landmarks.json", {});
  const cameras = readJson<CameraRecord[]>("cameras.json", []);
  const wikiPlaces = readJson<WikiPlace[]>("wiki-places.json", []);
  const rawSections = readJson<Record<string, [number, number, number, number]>>("map-sections.json", {});
  const landmarks3d = readJson<{ landmarks: RawLandmark3D[] }>("gtamaplib-landmarks3d.json", { landmarks: [] }).landmarks;

  const stats: SeedStats = {
    total: 0,
    landmarks: 0,
    cameras: 0,
    skippedNoCoords: 0,
    skippedDuplicates: 0,
    enriched3d: 0,
    wikiMatches: 0,
    photosIg: 0,
    photosRl: 0,
    byCategory: {},
  };
  const usedSlugs = new Set<string>();
  const uniqueSlug = (base: string, legacyId: string): string => {
    let slug = base || slugify(legacyId);
    if (usedSlugs.has(slug)) slug = `${slug}-${slugify(legacyId)}`;
    usedSlugs.add(slug);
    return slug;
  };
  const count = (slug: string) => (stats.byCategory[slug] = (stats.byCategory[slug] ?? 0) + 1);

  const wikiIndex = buildWikiIndex(wikiPlaces);
  // Index zones/quartiers : toutes les pages wiki (lieux + zones), clé = titre normalisé.
  const areaWikiIndex = new Map<string, WikiPlace>();
  for (const p of wikiPlaces) {
    const key = matchKey(p.title.replace(/\s*\((HD Universe|town)\)$/, ""));
    if (!areaWikiIndex.has(key) || p.kind === "area") areaWikiIndex.set(key, p);
  }
  const areaWikiFor = (area: string | null): LocationWiki | null => {
    if (!area) return null;
    const first = area.split(", ")[0];
    return toWiki(areaWikiIndex.get(matchKey(first)) ?? areaWikiIndex.get(matchKey(first.replace(/ National Park$/, ""))));
  };
  const index3d = new Map(landmarks3d.map((l) => [matchKey(l.name), l]));
  const locations: Location[] = [];

  // ── 1. Landmarks gtadb ──
  for (const [legacyId, row] of Object.entries(gtadb)) {
    const [igAddress, igCoords, igPhoto, rlAddress, rlCoords, rlPhoto, tags, color, edited] = row;
    if (igCoords.length !== 2) {
      stats.skippedNoCoords += 1;
      continue;
    }
    if (isDuplicateTagged(tags)) {
      stats.skippedDuplicates += 1;
      continue;
    }
    const [x, y] = [Number(igCoords[0].toFixed(2)), Number(igCoords[1].toFixed(2))];
    const ig = parseInGameAddress(igAddress);
    const rl = parseRealWorldAddress(rlAddress);
    const displayName = ig.name ?? rl.name ?? `Lieu ${legacyId}`;
    const slug = uniqueSlug(slugify(displayName), legacyId);
    const categorySlug = categoryFromTags(tags);

    // 3D
    let z: number | null = null;
    let height: number | null = null;
    for (const key of [ig.name, rl.name].filter((n): n is string => !!n).map(matchKey)) {
      const lm = index3d.get(key);
      if (lm) {
        z = Number(lm.xyz[2].toFixed(1));
        height = Number(lm.height.toFixed(1));
        stats.enriched3d += 1;
        break;
      }
    }
    // Wiki
    let wiki: LocationWiki | null = null;
    for (const key of [ig.name].filter((n): n is string => !!n).map(matchKey)) {
      const w = wikiIndex.get(key);
      if (w) {
        wiki = toWiki(w);
        stats.wikiMatches += 1;
        break;
      }
    }
    // Photos : présence déclarée par la source (dimensions), pas par le miroir local —
    // l'app sert depuis public/photos, R2 ou map.gtadb.org selon la config (src/lib/media.ts).
    const photos = { ig: null as string | null, irl: null as string | null };
    if (igPhoto.length === 2) {
      photos.ig = `gtadb/${legacyId}-ig.jpg`;
      stats.photosIg += 1;
    }
    if (rlPhoto.length === 2) {
      photos.irl = `gtadb/${legacyId}-rl.jpg`;
      stats.photosRl += 1;
    }

    locations.push({
      id: stableUuid("gtadb", legacyId),
      legacyId,
      slug,
      kind: "landmark",
      name: displayName,
      nameStatus: ig.status,
      area: ig.area,
      categorySlug,
      x,
      y,
      z,
      height,
      latLng: worldToLatLng(x, y),
      description: wiki?.extract ?? null,
      tags: tags.filter((t) => !/^duplicate-of-/.test(t)),
      flags: flagsFromTags(tags),
      color: `#${color}`,
      photos,
      media: null,
      wiki,
      areaWiki: areaWikiFor(ig.area),
      realWorld: {
        name: rl.name,
        address: rl.address,
        lat: rlCoords.length === 2 ? rlCoords[0] : null,
        lng: rlCoords.length === 2 ? rlCoords[1] : null,
        status: rl.status,
      },
      source: "gtadb",
      updatedAt: new Date(Math.max(...edited.filter(Boolean)) * 1000 || Date.now()).toISOString(),
    });
    stats.landmarks += 1;
    count(categorySlug);
  }

  // ── 2. Caméras officielles (trailers / screenshots) ──
  // Plusieurs caméras peuvent partager un id gtamaplib (« [S3/1] Port Vice City (A) / (B) ») :
  // `legacy_id` est unique en base → suffixe `/2`, `/3`… (le numéro reste en 2e segment).
  const legacySeen = new Map<string, number>();
  for (const cam of cameras) {
    const dup = (legacySeen.get(cam.id) ?? 0) + 1;
    legacySeen.set(cam.id, dup);
    const legacyId = dup === 1 ? cam.id : `${cam.id}/${dup}`;
    const slugBase = `${cam.group.toLowerCase()}-${cam.id.split("/")[1]}-${slugify(cam.name)}`;
    const frameFile = `${slugBase}.jpg`;
    const categorySlug = categoryForCamera(cam.group);
    const [x, y, z] = cam.xyz.map((v) => Number(v.toFixed(2)));
    const sourceMatch = /^(.*?)\s*\[(\d+|\?)\]$/.exec(cam.source);
    const sourceLabel = cam.group === "T1" ? "Trailer 1" : cam.group === "T2" ? "Trailer 2" : "Screenshot officiel";
    const frameIndex = sourceMatch && sourceMatch[2] !== "?" ? Number(sourceMatch[2]) : null;
    const slug = uniqueSlug(slugBase, cam.id);
    const label = `${cam.group === "S2" || cam.group === "S3" ? "S" : cam.group}${cam.group.startsWith("S") ? "" : "-"}${cam.id.split("/")[1]}`;

    // Zone : section contenant la caméra
    let area: string | null = null;
    for (const [name, [xMin, yMin, xMax, yMax]] of Object.entries(rawSections)) {
      if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
        area = name;
        break;
      }
    }

    locations.push({
      id: stableUuid("gtamaplib-camera", cam.id + cam.name),
      legacyId,
      slug,
      kind: "camera",
      name: cam.name,
      nameStatus: "confirmed",
      area,
      categorySlug,
      x,
      y,
      z,
      height: null,
      latLng: worldToLatLng(x, y),
      description: `${sourceLabel}${frameIndex !== null ? ` — plan ${frameIndex}` : ""} · position caméra triangulée par gtamaplib (${label}).`,
      tags: [cam.group.toLowerCase(), sourceLabel.toLowerCase()],
      flags: [],
      color: categorySlug === "trailer-1" ? "#f976b0" : categorySlug === "trailer-2" ? "#eb4c93" : "#8cdbf3",
      photos: { ig: null, irl: null },
      media: {
        frame: frameFile,
        thumb: `${slugBase}-thumb.jpg`,
        sourceLabel,
        source: cam.source,
        frameIndex,
        yaw: cam.ypr[0],
        pitch: cam.ypr[1],
        hfov: cam.fov[0],
        width: cam.size[0],
        height: cam.size[1],
      },
      wiki: null,
      areaWiki: areaWikiFor(area),
      realWorld: { name: null, address: null, lat: null, lng: null, status: "unknown" },
      source: "gtamaplib",
      updatedAt: new Date().toISOString(),
    });
    stats.cameras += 1;
    count(categorySlug);
  }

  // ── 3. Sections ──
  const areaWiki = new Map(wikiPlaces.filter((p) => p.kind === "area").map((p) => [matchKey(p.title.replace(/\s*\((HD Universe|town)\)$/, "")), p]));
  // Page de zone dédiée si elle existe, sinon n'importe quelle page wiki du même
  // nom (ex. « Ambrosia » n'a pas de page « (town) » mais une page de lieu).
  const sections: MapSection[] = Object.entries(rawSections).map(([name, bounds]) => ({
    name,
    slug: slugify(name),
    bounds,
    wiki:
      toWiki(areaWiki.get(matchKey(name.replace(/ National Park$/, "")))) ??
      toWiki(areaWiki.get(matchKey(name))) ??
      areaWikiFor(name),
  }));

  // ── 4. Zones / quartiers (centre médian des landmarks par `area`) ──
  const sectionNames = new Set(Object.keys(rawSections).map((n) => matchKey(n)));
  const byArea = new Map<string, { xs: number[]; ys: number[] }>();
  for (const l of locations) {
    if (l.kind !== "landmark" || !l.area) continue;
    const name = l.area.split(", ")[0];
    const bucket = byArea.get(name) ?? { xs: [], ys: [] };
    bucket.xs.push(l.x);
    bucket.ys.push(l.y);
    byArea.set(name, bucket);
  }
  const median = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const areas: AreaInfo[] = [...byArea.entries()]
    .filter(([name, b]) => b.xs.length >= 3 && !sectionNames.has(matchKey(name)))
    .map(([name, b]) => ({
      name,
      slug: slugify(name),
      x: Math.round(median(b.xs)),
      y: Math.round(median(b.ys)),
      count: b.xs.length,
      wiki: areaWikiFor(name),
    }))
    .sort((a, b) => b.count - a.count);

  locations.sort((a, b) => a.slug.localeCompare(b.slug));
  stats.total = locations.length;
  return { locations, sections, areas, stats };
}

// ───────────────────────────── Sorties ─────────────────────────────

function writeGenerated(
  locations: Location[],
  sections: MapSection[],
  areas: AreaInfo[],
  categories: readonly Category[],
  stats: SeedStats,
): void {
  ensureDir(OUT_DIR);
  const meta = {
    generatedAt: new Date().toISOString(),
    counts: {
      locations: stats.total,
      landmarks: stats.landmarks,
      cameras: stats.cameras,
      categories: categories.length,
      sections: sections.length,
      areas: areas.length,
    },
    byCategory: stats.byCategory,
    sources: [
      "map.gtadb.org (landmarks, photos — Public Domain)",
      "gtamaplib / rolux (caméras trailers & screenshots — MIT)",
      "gta.wiki (extraits & images — CC BY-NC-SA 3.0)",
      "Rockstar Games (frames de trailers & screenshots officiels — © Rockstar Games, usage fan non commercial)",
    ],
  };
  if (DRY_RUN) return;
  writeFileSync(path.join(OUT_DIR, "locations.json"), JSON.stringify(locations));
  writeFileSync(path.join(OUT_DIR, "sections.json"), JSON.stringify(sections, null, 2));
  writeFileSync(path.join(OUT_DIR, "areas.json"), JSON.stringify(areas, null, 2));
  writeFileSync(path.join(OUT_DIR, "categories.json"), JSON.stringify(categories, null, 2));
  writeFileSync(path.join(OUT_DIR, "meta.json"), JSON.stringify(meta, null, 2));
}

async function upsertSupabase(locations: Location[], categories: readonly Category[], sections: MapSection[]): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log("↷ Supabase non configuré (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) — étape DB ignorée.");
    return;
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { error: catError } = await supabase.from("categories").upsert(
    categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      description: c.description,
      group: c.group,
      icon: c.icon,
      color: c.color,
      sort_order: c.sortOrder,
      trackable: c.trackable,
    })),
    { onConflict: "slug" },
  );
  if (catError) throw new Error(`categories upsert: ${catError.message}`);

  const { data: catRows, error: catReadError } = await supabase.from("categories").select("id, slug");
  if (catReadError || !catRows) throw new Error(`categories read: ${catReadError?.message}`);
  const catIdBySlug = new Map(catRows.map((r) => [r.slug as string, r.id as string]));

  const rows = locations.map((l) => ({
    id: l.id,
    legacy_id: l.legacyId,
    slug: l.slug,
    kind: l.kind,
    name: l.name,
    name_status: l.nameStatus,
    area: l.area,
    category_id: catIdBySlug.get(l.categorySlug),
    x: l.x,
    y: l.y,
    z: l.z,
    height: l.height,
    description: l.description,
    tags: l.tags,
    flags: l.flags,
    color: l.color,
    photo_ig: l.photos.ig,
    photo_irl: l.photos.irl,
    media: l.media,
    wiki: l.wiki,
    area_wiki: l.areaWiki,
    irl_name: l.realWorld.name,
    irl_address: l.realWorld.address,
    irl_lat: l.realWorld.lat,
    irl_lng: l.realWorld.lng,
    irl_status: l.realWorld.status,
    source: l.source,
    updated_at: l.updatedAt,
  }));

  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from("locations").upsert(rows.slice(i, i + CHUNK), { onConflict: "legacy_id" });
    if (error) throw new Error(`locations upsert (chunk ${i / CHUNK}): ${error.message}`);
    console.log(`  ↑ ${Math.min(i + CHUNK, rows.length)}/${rows.length} lieux`);
  }

  if (sections.length) {
    const { error } = await supabase.from("map_sections").upsert(
      sections.map((s) => ({ slug: s.slug, name: s.name, x_min: s.bounds[0], y_min: s.bounds[1], x_max: s.bounds[2], y_max: s.bounds[3], wiki: s.wiki })),
      { onConflict: "slug" },
    );
    if (error) console.warn(`  ⚠ map_sections upsert : ${error.message} (migration 0002 appliquée ?)`);
    else console.log(`  ↑ ${sections.length} sections`);
  }
}

// ───────────────────────────── Main ─────────────────────────────

async function main(): Promise<void> {
  console.log(`▶ Seed GTA VI map${DRY_RUN ? " (dry-run)" : ""}`);
  const { locations, sections, areas, stats } = build();
  console.log(
    `  → ${stats.total} points : ${stats.landmarks} landmarks + ${stats.cameras} caméras (ignorés : ${stats.skippedNoCoords} sans coordonnées, ${stats.skippedDuplicates} doublons)`,
  );
  console.log(`  → enrichis 3D : ${stats.enriched3d} · fiches wiki : ${stats.wikiMatches} · photos : ${stats.photosIg} in-game, ${stats.photosRl} réelles`);
  console.log("  → par catégorie :", stats.byCategory);
  writeGenerated(locations, sections, areas, CATEGORY_DEFINITIONS, stats);
  console.log(`  → zones : ${areas.length} (${areas.filter((a) => a.wiki).length} avec fiche wiki) · sections : ${sections.length}`);
  if (!DRY_RUN) console.log(`  ✓ JSON statiques écrits dans ${path.relative(ROOT, OUT_DIR)}`);
  if (!SKIP_DB) {
    console.log("▶ Upsert Supabase");
    await upsertSupabase(locations, CATEGORY_DEFINITIONS, sections);
    console.log("  ✓ terminé");
  }
}

main().catch((err) => {
  console.error("✗ Seed échoué :", err instanceof Error ? err.message : err);
  process.exit(1);
});
