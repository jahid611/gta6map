/* eslint-disable no-console */
/**
 * Miroir local d'un jeu de tuiles map.gtadb.org → public/tiles/{set}/…
 * (pour auto-héberger sur R2/S3 via `npm run assets:upload` et
 * `NEXT_PUBLIC_TILES_BASE_URL=https://<cdn>/tiles`).
 *
 * yanis,15 ≈ 32 000 tuiles / ~300 Mo. Reprise possible (fichiers existants ignorés).
 *
 * Usage : npm run assets:mirror [-- --set yanis,15] [--concurrency 16] [--max-zoom 6]
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { TileSetId } from "../src/types/map";
import { DEFAULT_TILE_SET, MAX_NATIVE_ZOOM, TILE_SETS } from "../src/lib/map/config";
import { countTiles } from "../src/lib/map/tiles";

const ROOT = path.resolve(__dirname, "..");
const REMOTE = "https://maps.gtadb.org/tiles/6";
const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
const SET = arg("--set", DEFAULT_TILE_SET) as TileSetId;
const CONCURRENCY = Number(arg("--concurrency", "16"));
const MAX_Z = Number(arg("--max-zoom", String(MAX_NATIVE_ZOOM)));

async function main(): Promise<void> {
  const def = TILE_SETS[SET];
  if (!def) throw new Error(`Jeu de tuiles inconnu : ${SET} (${Object.keys(TILE_SETS).join(", ")})`);
  const outDir = path.join(ROOT, "public", "tiles", SET);
  const jobs: { z: number; x: number; y: number }[] = [];
  for (const [zStr, range] of Object.entries(def.ranges)) {
    const z = Number(zStr);
    if (z > MAX_Z) continue;
    const [[x0, y0], [x1, y1]] = range;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) jobs.push({ z, x, y });
  }
  console.log(`▶ Miroir ${SET} : ${jobs.length}/${countTiles(SET)} tuiles → public/tiles/${SET}`);
  let i = 0;
  let done = 0;
  let skipped = 0;
  let missing = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < jobs.length) {
        const { z, x, y } = jobs[i++];
        const dir = path.join(outDir, String(z));
        const file = path.join(dir, `${z},${y},${x}.jpg`);
        if (existsSync(file)) {
          skipped += 1;
          continue;
        }
        try {
          const res = await fetch(`${REMOTE}/${SET}/${z}/${z},${y},${x}.jpg`);
          if (res.status === 404) {
            missing += 1;
            continue;
          }
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          mkdirSync(dir, { recursive: true });
          writeFileSync(file, Buffer.from(await res.arrayBuffer()));
          done += 1;
          if (done % 500 === 0) console.log(`  ${done + skipped}/${jobs.length}`);
        } catch (err) {
          console.warn(`  ⚠ ${z}/${y}/${x}: ${err instanceof Error ? err.message : err}`);
        }
      }
    }),
  );
  console.log(`✓ ${done} téléchargées, ${skipped} déjà présentes, ${missing} absentes côté serveur`);
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
