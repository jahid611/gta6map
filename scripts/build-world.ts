/**
 * Génère les « quartiers » 3D du mode piéton (`/street`) à partir d'OpenStreetMap.
 *
 * Le principe du mode piéton : la géographie de Leonida est un décalque de la
 * Floride réelle, et 1 043 fiches du site portent des coordonnées réelles
 * confirmées. On reconstruit donc les rues de Miami — emprises de bâtiments,
 * voirie, eau, végétation — puis on les habille de deux façons : la vraie vie
 * (photos réelles) et le jeu (captures des leaks). Marcher est identique dans
 * les deux ; seule la peau change.
 *
 * Les données viennent d'Overpass (OpenStreetMap, ODbL). On les fige ici, au
 * build, plutôt que de les appeler depuis le navigateur : Overpass est lent et
 * capricieux, et un quartier ne bouge pas d'un jour à l'autre.
 *
 *   npx tsx scripts/build-world.ts            # tous les quartiers
 *   npx tsx scripts/build-world.ts vice-beach # un seul
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import locationsJson from "../src/data/generated/locations.json";

const OUT_DIR = join(process.cwd(), "src/data/generated/world");

/**
 * Miroirs Overpass — le premier qui répond gagne. L'instance principale sature
 * régulièrement (504) ; les miroirs se relaient.
 */
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
];

interface ZoneSpec {
  id: string;
  name: string;
  /** Zones du jeu correspondantes, telles qu'écrites dans `locations.json`. */
  areas: string[];
  /** [sud, ouest, nord, est] */
  bbox: [number, number, number, number];
  /** Où le joueur apparaît : [lat, lng] et cap en degrés (0 = nord). */
  spawn: [number, number, number];
}

const ZONES: ZoneSpec[] = [
  {
    id: "vice-beach",
    name: "Vice Beach",
    areas: ["Vice Beach", "Shore Dr, Vice Beach"],
    bbox: [25.7655, -80.1425, 25.7995, -80.1215],
    // Ocean Drive à hauteur de la 10e, face à la plage, regard vers le nord.
    spawn: [25.7808, -80.1301, 350],
  },
  {
    id: "vice-city-downtown",
    name: "Downtown, Vice City",
    areas: ["Downtown, Vice City", "Vice City", "Tequesta, Vice City", "Rockridge, Vice City"],
    bbox: [25.7635, -80.2035, 25.7885, -80.1795],
    spawn: [25.7742, -80.1902, 20],
  },
];

// ── Overpass ────────────────────────────────────────────────────────────────

interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

/**
 * Trois requêtes plutôt qu'une : une requête courte aboutit bien plus souvent
 * qu'une requête qui demande tout le quartier d'un coup, et un échec ne coûte
 * qu'un tiers du travail.
 */
function queries(bbox: [number, number, number, number]): { label: string; body: string }[] {
  const b = bbox.join(",");
  const head = "[out:json][timeout:240];";
  return [
    {
      label: "bâtiments",
      body: `${head}way["building"](${b});out geom qt;`,
    },
    {
      label: "voirie",
      body: `${head}way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|service|pedestrian|footway|path|cycleway|steps)$"](${b});out geom qt;`,
    },
    {
      label: "eau, verdure, arbres",
      body: `${head}(way["natural"~"^(water|beach|sand|coastline)$"](${b});way["waterway"="riverbank"](${b});way["leisure"~"^(park|garden|pitch|golf_course|swimming_pool)$"](${b});way["landuse"~"^(grass|forest|recreation_ground)$"](${b});node["natural"="tree"](${b}););out geom qt;`,
    },
  ];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Overpass répond 406 à toute requête sans `User-Agent` explicite — et le
 * `fetch` de Node n'en envoie aucun. C'est aussi ce que demande sa charte
 * d'usage : s'identifier.
 */
const HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  "User-Agent": "gta6map.pro world builder (https://gta6map.pro)",
  Accept: "application/json",
};

/** Tourne sur tous les miroirs, plusieurs fois, avant d'abandonner. */
async function fetchOverpass(label: string, data: string): Promise<OsmElement[]> {
  const body = `data=${encodeURIComponent(data)}`;
  let lastError: unknown;
  for (let round = 1; round <= 6; round++) {
    for (const url of ENDPOINTS) {
      const host = new URL(url).host;
      try {
        process.stdout.write(`   ${label} <- ${host}... `);
        const res = await fetch(url, { method: "POST", headers: HEADERS, body });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!text.startsWith("{")) throw new Error("réponse non JSON (serveur saturé)");
        const json = JSON.parse(text) as { elements: OsmElement[] };
        console.log(`${json.elements.length} éléments`);
        return json.elements;
      } catch (error) {
        lastError = error;
        console.log(`échec — ${(error as Error).message}`);
        await sleep(2500);
      }
    }
    const wait = round * 20;
    console.log(`   (tous les miroirs muets, nouvelle tentative dans ${wait} s)`);
    await sleep(wait * 1000);
  }
  throw lastError;
}

async function overpass(bbox: [number, number, number, number]): Promise<OsmElement[]> {
  const all: OsmElement[] = [];
  for (const { label, body } of queries(bbox)) {
    all.push(...(await fetchOverpass(label, body)));
  }
  return all;
}

// ── Projection locale ───────────────────────────────────────────────────────

/**
 * Repère métrique local, centré sur l'origine du quartier : `x` vers l'est,
 * `z` vers le sud (le nord est donc `-z`, comme la caméra three.js par défaut).
 * Une équirectangulaire suffit : sur 3 km l'erreur reste sous le mètre.
 */
function projector(originLat: number, originLng: number) {
  const M_PER_DEG_LAT = 111_320;
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((originLat * Math.PI) / 180);
  return (lat: number, lng: number): [number, number] => [
    (lng - originLng) * mPerDegLng,
    (originLat - lat) * M_PER_DEG_LAT,
  ];
}

// ── Géométrie ───────────────────────────────────────────────────────────────

type Ring = number[]; // [x0, z0, x1, z1, …]

function ringArea(p: Ring): number {
  let a = 0;
  for (let i = 0, n = p.length / 2; i < n; i++) {
    const j = (i + 1) % n;
    a += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1];
  }
  return a / 2;
}

/**
 * Retire le point de fermeture d'une *way* OSM et les doublons consécutifs.
 *
 * Indispensable avant de simplifier : Douglas-Peucker travaille entre le
 * premier et le dernier point, et sur un anneau fermé ces deux points sont
 * confondus. La corde de référence est alors nulle, toutes les distances valent
 * zéro, et l'anneau entier se réduit à ses deux extrémités — plans d'eau,
 * plages et pelouses disparaissaient ainsi en silence.
 */
function openRing(p: Ring): Ring {
  const out: Ring = [];
  for (let i = 0; i < p.length; i += 2) {
    const n = out.length;
    if (n >= 2 && Math.abs(out[n - 2] - p[i]) < 1e-6 && Math.abs(out[n - 1] - p[i + 1]) < 1e-6) {
      continue;
    }
    out.push(p[i], p[i + 1]);
  }
  const n = out.length;
  if (n >= 6 && Math.abs(out[0] - out[n - 2]) < 1e-6 && Math.abs(out[1] - out[n - 1]) < 1e-6) {
    out.length -= 2;
  }
  return out;
}

/** Douglas-Peucker sur une polyligne ouverte : divise par ~3 le poids des fichiers. */
function simplify(p: Ring, tolerance: number): Ring {
  const n = p.length / 2;
  if (n < 4) return p;
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const segment = stack.pop();
    if (!segment) break;
    const [first, last] = segment;
    let maxDist = 0;
    let index = -1;
    const ax = p[first * 2];
    const az = p[first * 2 + 1];
    const dx = p[last * 2] - ax;
    const dz = p[last * 2 + 1] - az;
    const len = Math.hypot(dx, dz) || 1;
    for (let i = first + 1; i < last; i++) {
      const d = Math.abs((p[i * 2] - ax) * dz - (p[i * 2 + 1] - az) * dx) / len;
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist > tolerance && index > 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  const out: Ring = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(p[i * 2], p[i * 2 + 1]);
  return out;
}

function centroid(p: Ring): [number, number] {
  let x = 0;
  let z = 0;
  const n = p.length / 2;
  for (let i = 0; i < n; i++) {
    x += p[i * 2];
    z += p[i * 2 + 1];
  }
  return [x / n, z / n];
}

function reverse(p: Ring): Ring {
  const out: Ring = [];
  for (let i = p.length / 2 - 1; i >= 0; i--) out.push(p[i * 2], p[i * 2 + 1]);
  return out;
}

function round(p: Ring): Ring {
  return p.map((v) => Math.round(v * 10) / 10);
}

function pointInRing(x: number, z: number, p: Ring): boolean {
  let inside = false;
  for (let i = 0, n = p.length / 2, j = n - 1; i < n; j = i++) {
    const xi = p[i * 2];
    const zi = p[i * 2 + 1];
    const xj = p[j * 2];
    const zj = p[j * 2 + 1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// ── Hauteurs ────────────────────────────────────────────────────────────────

const STOREY = 3.2;

/** Hauteur par défaut quand OSM ne dit rien — calée sur la silhouette réelle des quartiers. */
const DEFAULT_HEIGHT: Record<string, number> = {
  apartments: 16,
  residential: 14,
  hotel: 22,
  commercial: 14,
  office: 30,
  retail: 9,
  house: 6,
  detached: 6,
  bungalow: 4.5,
  garage: 3,
  garages: 3,
  roof: 3.5,
  church: 14,
  school: 9,
  hospital: 24,
  industrial: 10,
  warehouse: 9,
  parking: 12,
  yes: 9,
};

function heightOf(tags: Record<string, string>, area: number): number {
  const explicit = parseFloat(tags["height"] ?? tags["building:height"] ?? "");
  if (Number.isFinite(explicit) && explicit > 1) return Math.min(explicit, 320);
  const levels = parseFloat(tags["building:levels"] ?? "");
  if (Number.isFinite(levels) && levels >= 1) return Math.min(levels * STOREY + 1, 320);
  const base = DEFAULT_HEIGHT[tags["building"]] ?? DEFAULT_HEIGHT[tags["building:use"]] ?? 9;
  // Une grande emprise sans étage renseigné est plus souvent un centre commercial
  // qu'une tour : on la garde basse.
  return area > 4000 ? Math.min(base, 12) : base;
}

// ── Lieux du site ───────────────────────────────────────────────────────────

interface SiteLocation {
  slug: string;
  name: string;
  area: string | null;
  categorySlug: string;
  x: number;
  y: number;
  color: string | null;
  photos: { ig?: string; irl?: string } | null;
  realWorld: { lat: number; lng: number; address?: string | null; status?: string } | null;
}

const LOCATIONS = locationsJson as unknown as SiteLocation[];

const ROAD_WIDTH: Record<string, number> = {
  motorway: 22,
  trunk: 18,
  primary: 16,
  secondary: 13,
  tertiary: 11,
  residential: 9,
  unclassified: 8,
  living_street: 7,
  service: 5,
  pedestrian: 6,
  footway: 2.5,
  path: 2,
  cycleway: 2.5,
  steps: 2,
};

// ── Construction d'un quartier ──────────────────────────────────────────────

async function buildZone(zone: ZoneSpec) {
  console.log(`\n> ${zone.name}`);
  const elements = await overpass(zone.bbox);

  const [south, west, north, east] = zone.bbox;
  const originLat = (south + north) / 2;
  const originLng = (west + east) / 2;
  const project = projector(originLat, originLng);

  const buildings: {
    p: Ring;
    h: number;
    k: string;
    n?: string;
    c: [number, number];
    loc?: string;
  }[] = [];
  const roads: { p: Ring; w: number; k: string; n?: string }[] = [];
  const water: Ring[] = [];
  const sand: Ring[] = [];
  const green: Ring[] = [];
  const coast: Ring[] = [];
  const trees: [number, number][] = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    if (el.type === "node") {
      if (tags["natural"] === "tree" && el.lat != null && el.lon != null) {
        trees.push(project(el.lat, el.lon));
      }
      continue;
    }
    const geom = el.geometry;
    if (!geom || geom.length < 2) continue;

    const ring: Ring = [];
    for (const g of geom) {
      const [x, z] = project(g.lat, g.lon);
      ring.push(x, z);
    }

    if (tags["building"] || tags["building:part"]) {
      const outline = openRing(ring);
      if (outline.length < 6) continue;
      const simplified = simplify(outline, 0.6);
      if (simplified.length < 6) continue;
      const area = Math.abs(ringArea(simplified));
      if (area < 12) continue; // abris de jardin, conteneurs…
      // Sens antihoraire imposé : tous les murs regarderont vers l'extérieur.
      const oriented = ringArea(simplified) < 0 ? reverse(simplified) : simplified;
      buildings.push({
        p: round(oriented),
        h: Math.round(heightOf(tags, area) * 10) / 10,
        k: tags["building"] === "yes" ? (tags["building:use"] ?? "yes") : tags["building"],
        n: tags["name"],
        c: centroid(oriented),
      });
      continue;
    }

    if (tags["highway"]) {
      const lanes = parseFloat(tags["lanes"] ?? "");
      const base = ROAD_WIDTH[tags["highway"]] ?? 7;
      roads.push({
        p: round(simplify(ring, 0.8)),
        w: Number.isFinite(lanes) ? Math.max(base, lanes * 3.4) : base,
        k: tags["highway"],
        n: tags["name"],
      });
      continue;
    }

    if (tags["natural"] === "coastline") {
      // Une limite, pas une surface : elle reste ouverte, et c'est le rendu qui
      // en déduit la mer (à droite du sens de parcours, convention OSM).
      if (ring.length >= 4) coast.push(round(simplify(ring, 1.5)));
      continue;
    }

    const opened = openRing(ring);
    if (opened.length < 8) continue;
    const poly = round(simplify(opened, 1.2));
    if (tags["natural"] === "water" || tags["waterway"] === "riverbank") water.push(poly);
    else if (tags["natural"] === "beach" || tags["natural"] === "sand") sand.push(poly);
    else green.push(poly);
  }

  // ── Rattachement des fiches du site ───────────────────────────────────────
  const spots: {
    slug: string;
    name: string;
    x: number;
    z: number;
    ig?: string;
    irl?: string;
    cat: string;
    color?: string;
    area?: string;
    gx: number;
    gy: number;
    address?: string;
  }[] = [];

  for (const loc of LOCATIONS) {
    const rw = loc.realWorld;
    if (!rw?.lat || !rw?.lng) continue;
    if (rw.lat < south || rw.lat > north || rw.lng < west || rw.lng > east) continue;
    const [x, z] = project(rw.lat, rw.lng);
    spots.push({
      slug: loc.slug,
      name: loc.name,
      x: Math.round(x * 10) / 10,
      z: Math.round(z * 10) / 10,
      ig: loc.photos?.ig,
      irl: loc.photos?.irl,
      cat: loc.categorySlug,
      color: loc.color ?? undefined,
      area: loc.area ?? undefined,
      gx: loc.x,
      gy: loc.y,
      address: rw.address ?? undefined,
    });
  }

  // Chaque fiche s'accroche au bâtiment qui la contient, sinon au plus proche
  // dans un rayon de 35 m : c'est sa façade qui portera la photo.
  for (const spot of spots) {
    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const d = Math.hypot(b.c[0] - spot.x, b.c[1] - spot.z);
      if (d > 90 || buildings[i].loc) continue;
      const score = pointInRing(spot.x, spot.z, b.p) ? d - 1000 : d;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best >= 0 && (bestScore < -900 || bestScore < 35)) {
      buildings[best].loc = spot.slug;
      if (!buildings[best].n) buildings[best].n = spot.name;
    }
  }

  const [spawnLat, spawnLng, spawnHeading] = zone.spawn;
  const [sx, sz] = project(spawnLat, spawnLng);

  const world = {
    id: zone.id,
    name: zone.name,
    areas: zone.areas,
    origin: [originLat, originLng] as [number, number],
    bbox: zone.bbox,
    spawn: { x: Math.round(sx * 10) / 10, z: Math.round(sz * 10) / 10, heading: spawnHeading },
    buildings: buildings.map((b) => ({
      p: b.p,
      h: b.h,
      k: b.k,
      ...(b.n ? { n: b.n } : {}),
      ...(b.loc ? { loc: b.loc } : {}),
    })),
    roads,
    water,
    coast,
    sand,
    green,
    trees: trees.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]),
    spots,
    generatedAt: new Date().toISOString(),
    attribution: "© les contributeurs OpenStreetMap (ODbL)",
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const payload = JSON.stringify(world);
  writeFileSync(join(OUT_DIR, `${zone.id}.json`), payload);
  console.log(
    `   ${world.buildings.length} bâtiments · ${roads.length} voies · ${water.length} plans d'eau · ` +
      `${coast.length} traits de côte · ` +
      `${green.length} espaces verts · ${trees.length} arbres · ${spots.length} lieux ` +
      `(${buildings.filter((b) => b.loc).length} sur façade) -> ${Math.round(payload.length / 1024)} Ko`,
  );
  return world;
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const todo = only.length ? ZONES.filter((z) => only.includes(z.id)) : ZONES;
  if (!todo.length) {
    console.error(`Quartier inconnu. Disponibles : ${ZONES.map((z) => z.id).join(", ")}`);
    process.exit(1);
  }
  const index: { id: string; name: string; buildings: number; spots: number }[] = [];
  for (const zone of todo) {
    const world = await buildZone(zone);
    index.push({
      id: world.id,
      name: world.name,
      buildings: world.buildings.length,
      spots: world.spots.length,
    });
  }
  writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2));
  console.log(`\nOK — ${index.length} quartier(s) dans src/data/generated/world/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
