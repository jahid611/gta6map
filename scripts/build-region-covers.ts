/* eslint-disable no-console */
/**
 * Vues aériennes des régions dépourvues d'illustration officielle.
 *
 * Deux des huit régions (Mariana County, Leonard County) n'ont ni carte postale
 * Rockstar ni screenshot « Places », et les rares plans de trailers qui s'y
 * trouvent sont des intérieurs de voiture. La vignette wiki, elle, se réduit à
 * un panneau routier. On compose donc leur portrait à partir des tuiles de la
 * carte : c'est HD, c'est exactement la région, et ça reste dans la DA du site.
 *
 * Sortie : public/regions/<slug>.jpg (1600 × 900) + src/data/generated/region-covers.json
 * Usage : npm run build:region-covers   (nécessite `npm run assets:mirror` — les tuiles locales)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Jimp } from "jimp";

const ROOT = path.resolve(__dirname, "..");
const TILES = path.join(ROOT, "public", "tiles", "yanis,15");
const SECTIONS = path.join(ROOT, "src", "data", "generated", "sections.json");
const OUT_DIR = path.join(ROOT, "public", "regions");
const OUT_JSON = path.join(ROOT, "src", "data", "generated", "region-covers.json");

const TILE = 256;
const ZOOM = 5; // 1 px/m — assez fin pour lire le trait de côte
const SCALE = (1024 / 32_768) * 2 ** ZOOM; // px par mètre
const HALF = 16_384;
const OUT_W = 1600;
const OUT_H = 900;

/** Régions à couvrir : slug → largeur du cadrage en mètres. */
const TARGETS: Record<string, number> = {
  "mariana-county": 4200,
  "leonard-county": 4200,
};

interface Section {
  slug: string;
  name: string;
  bounds: [number, number, number, number];
}

const toPx = (x: number, y: number) => ({ px: (x + HALF) * SCALE, py: (HALF - y) * SCALE });

async function cover(section: Section, spanMeters: number, center: { x: number; y: number }): Promise<string | null> {
  // Cadrage 16:9 centré sur les LIEUX de la région, pas sur sa boîte : celle de
  // Leonard County déborde très au large, et une vue centrée dessus n'aurait
  // montré que de l'océan.
  const c = toPx(center.x, center.y);
  const w = spanMeters * SCALE;
  const h = (w * OUT_H) / OUT_W;
  const left = Math.round(c.px - w / 2);
  const top = Math.round(c.py - h / 2);

  const x0 = Math.floor(left / TILE);
  const y0 = Math.floor(top / TILE);
  const x1 = Math.floor((left + w) / TILE);
  const y1 = Math.floor((top + h) / TILE);

  const canvas = new Jimp({ width: (x1 - x0 + 1) * TILE, height: (y1 - y0 + 1) * TILE, color: 0x2d8fd5ff });
  let found = 0;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const file = path.join(TILES, String(ZOOM), `${ZOOM},${ty},${tx}.jpg`);
      if (!existsSync(file)) continue;
      canvas.composite(await Jimp.read(file), (tx - x0) * TILE, (ty - y0) * TILE);
      found += 1;
    }
  }
  if (!found) {
    console.warn(`  ⚠ ${section.name} : aucune tuile (lancer \`npm run assets:mirror\`)`);
    return null;
  }

  const image = canvas
    .crop({ x: left - x0 * TILE, y: top - y0 * TILE, w: Math.round(w), h: Math.round(h) })
    .resize({ w: OUT_W, h: OUT_H });
  mkdirSync(OUT_DIR, { recursive: true });
  const dest = path.join(OUT_DIR, `${section.slug}.jpg`);
  await image.write(dest as `${string}.jpg`, { quality: 86 });
  console.log(`  ✓ ${section.name} (${found} tuiles)`);
  return `/regions/${section.slug}.jpg`;
}

interface Loc {
  x: number;
  y: number;
  area: string | null;
  kind: string;
}

/** Centre = médiane des lieux rattachés à la région (par nom de zone, sinon par la boîte). */
function centerOf(section: Section, locations: Loc[]): { x: number; y: number } {
  const [xMin, yMin, xMax, yMax] = section.bounds;
  const named = locations.filter((l) => (l.area ?? "").split(", ").includes(section.name));
  const inBox = locations.filter((l) => l.x >= xMin && l.x <= xMax && l.y >= yMin && l.y <= yMax);
  const pool = named.length >= 3 ? named : inBox.length >= 3 ? inBox : [];
  if (!pool.length) return { x: (xMin + xMax) / 2, y: (yMin + yMax) / 2 };
  const median = (v: number[]) => v.sort((a, b) => a - b)[Math.floor(v.length / 2)];
  return { x: median(pool.map((l) => l.x)), y: median(pool.map((l) => l.y)) };
}

async function main(): Promise<void> {
  const sections = JSON.parse(readFileSync(SECTIONS, "utf8")) as Section[];
  const locations = JSON.parse(readFileSync(path.join(ROOT, "src", "data", "generated", "locations.json"), "utf8")) as Loc[];
  const covers: Record<string, string> = existsSync(OUT_JSON) ? JSON.parse(readFileSync(OUT_JSON, "utf8")) : {};
  for (const [slug, span] of Object.entries(TARGETS)) {
    const section = sections.find((s) => s.slug === slug);
    if (!section) continue;
    const url = await cover(section, span, centerOf(section, locations));
    if (url) covers[slug] = url;
  }
  writeFileSync(OUT_JSON, JSON.stringify(covers, null, 2));
  console.log(`✓ ${Object.keys(covers).length} vues aériennes → public/regions`);
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
