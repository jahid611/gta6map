/**
 * Compose le fond de carte du hero de la landing (`public/brand/map-hero.jpg`).
 *
 * La landing affiche la carte derrière le wordmark. Monter Leaflet pour ça
 * coûterait ~150 Ko de JS et une init complète pour une image décorative, et
 * poser la grille de tuiles en <img> ferait 100 requêtes par visite. On assemble
 * donc les tuiles UNE fois ici, en une seule image servie avec le cache immuable
 * déjà configuré sur `/brand/*` (cf. next.config.ts).
 *
 * Usage : npm run build:hero-map [-- --zoom 2] [--width 2048]
 * À relancer seulement si le jeu de tuiles change.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Jimp } from "jimp";
import { MAP_SIZE_METERS, TILE_SETS, TILE_SIZE, ZOOM0_SCALE, DEFAULT_TILE_SET } from "../src/lib/map/config";
import { buildTileUrl } from "../src/lib/map/tiles";
import sections from "../src/data/generated/sections.json";

const ROOT = path.resolve(__dirname, "..");
const OUT_PATH = path.join(ROOT, "public", "brand", "map-hero.jpg");

const argv = process.argv.slice(2);
function flag(name: string, fallback: number): number {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? Number(argv[i + 1]) : fallback;
}

/** z=2 : 10×10 tuiles = 2 560 px de côté, assez fin pour un fond dézoomé. */
const ZOOM = flag("zoom", 2);
const OUT_WIDTH = flag("width", 2048);
const CONCURRENCY = 6;

async function main(): Promise<void> {
  const ranges = TILE_SETS[DEFAULT_TILE_SET].ranges;
  const range = ranges[ZOOM];
  if (!range) throw new Error(`Aucune plage de tuiles pour z=${ZOOM}`);

  const [[x0, y0], [x1, y1]] = range;
  const cols = x1 - x0 + 1;
  const rows = y1 - y0 + 1;
  const total = cols * rows;
  console.log(`Assemblage z=${ZOOM} : ${cols}×${rows} = ${total} tuiles (${cols * TILE_SIZE} px)`);

  const canvas = new Jimp({ width: cols * TILE_SIZE, height: rows * TILE_SIZE, color: 0x2d8fd5ff });

  const jobs: { x: number; y: number }[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) jobs.push({ x, y });

  let done = 0;
  let failed = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const job = jobs.shift();
      if (!job) return;
      const url = buildTileUrl(DEFAULT_TILE_SET, { z: ZOOM, x: job.x, y: job.y });
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const tile = await Jimp.read(Buffer.from(await res.arrayBuffer()));
        canvas.composite(tile, (job.x - x0) * TILE_SIZE, (job.y - y0) * TILE_SIZE);
      } catch (err) {
        // Une tuile manquante laisse le bleu océan du fond : le rendu reste
        // correct, on se contente de le signaler.
        failed++;
        console.warn(`  ! ${ZOOM},${job.y},${job.x} — ${(err as Error).message}`);
      }
      done++;
      if (done % 20 === 0 || done === total) console.log(`  ${done}/${total}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Recadrage sur l'emprise jouable.
  //
  // Le fond communautaire Yanis embarque, dans ses propres tuiles, un panneau de
  // legende + credits + planche de frames qui occupe tout le tiers gauche de la
  // couverture. Assemble tel quel, il finirait derriere le wordmark. On recadre
  // donc sur l'union des bornes des 8 regions (plus une marge), ce qui ne garde
  // que les terres et suit automatiquement les donnees si elles changent.
  const bounds = (sections as { bounds: number[] }[]).map((s) => s.bounds);
  const MARGIN = 1_200; // m de respiration autour des terres
  // Pas de marge a l'ouest : le panneau de legende bave jusqu'a x ~ -10 300, soit
  // 300 m a peine avant la cote ouest de Port Gellhorn (x = -10 000). Toute marge
  // de ce cote reintroduirait un liseré de legende dans le cadre.
  const xMin = Math.min(...bounds.map((b) => b[0]));
  const yMin = Math.min(...bounds.map((b) => b[1])) - MARGIN;
  const xMax = Math.max(...bounds.map((b) => b[2])) + MARGIN;
  const yMax = Math.max(...bounds.map((b) => b[3])) + MARGIN;

  // Monde -> pixel du canvas (y monde croit vers le nord, y pixel vers le bas).
  const scale = ZOOM0_SCALE * 2 ** ZOOM; // px/m
  const half = MAP_SIZE_METERS / 2;
  const toX = (wx: number) => Math.round((wx + half) * scale) - x0 * TILE_SIZE;
  const toY = (wy: number) => Math.round((half - wy) * scale) - y0 * TILE_SIZE;

  const cropX = Math.max(0, toX(xMin));
  const cropY = Math.max(0, toY(yMax));
  const cropW = Math.min(canvas.bitmap.width - cropX, toX(xMax) - cropX);
  const cropH = Math.min(canvas.bitmap.height - cropY, toY(yMin) - cropY);
  console.log(`Recadrage : ${cropW}x${cropH} px a partir de (${cropX}, ${cropY})`);
  canvas.crop({ x: cropX, y: cropY, w: cropW, h: cropH });

  canvas.resize({ w: OUT_WIDTH });
  // Jimp n encode pas le WebP : on sort en JPEG, que next/image resservira
  // de toute facon en AVIF/WebP selon le navigateur.
  const buffer = await canvas.getBuffer("image/jpeg", { quality: 78 });

  mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, buffer);
  console.log(`\n→ ${path.relative(ROOT, OUT_PATH)} — ${OUT_WIDTH} px, ${(buffer.length / 1024).toFixed(0)} Ko${failed ? `, ${failed} tuile(s) manquante(s)` : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
