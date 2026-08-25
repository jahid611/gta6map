/* eslint-disable no-console */
/**
 * Convertit les vignettes gta.wiki (PNG lourds, ~35 Mo pour 46 fichiers) en JPEG
 * 1280 px max (~4 Mo) pour pouvoir les versionner et les servir depuis Vercel.
 * Met à jour `data/raw/wiki-places.json` (`image.local`) → relancer `npm run seed`.
 *
 * Usage : npm run optimize:wiki
 */
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Jimp } from "jimp";
import type { WikiPlace } from "./fetch-wiki";

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "public", "wiki");
const PLACES = path.join(ROOT, "data", "raw", "wiki-places.json");
const MAX_W = 1280;

async function main(): Promise<void> {
  if (!existsSync(DIR)) throw new Error("public/wiki absent — lancer `npm run fetch:wiki`");
  const renamed = new Map<string, string>();
  let before = 0;
  let after = 0;
  for (const file of readdirSync(DIR)) {
    if (!/\.(png|jpe?g|webp)$/i.test(file)) continue;
    const src = path.join(DIR, file);
    const target = file.replace(/\.(png|jpe?g|webp)$/i, ".jpg");
    const dest = path.join(DIR, target);
    const image = await Jimp.read(src);
    before += readFileSync(src).length;
    if (image.width > MAX_W) image.resize({ w: MAX_W });
    const buf = await image.getBuffer("image/jpeg", { quality: 82 });
    if (target !== file) unlinkSync(src);
    writeFileSync(dest, buf);
    after += buf.length;
    renamed.set(file, target);
    console.log(`  ✓ ${file} → ${target} (${(buf.length / 1024).toFixed(0)} Ko)`);
  }
  if (existsSync(PLACES)) {
    const places = JSON.parse(readFileSync(PLACES, "utf8")) as WikiPlace[];
    for (const p of places) if (p.image?.local && renamed.has(p.image.local)) p.image.local = renamed.get(p.image.local)!;
    writeFileSync(PLACES, JSON.stringify(places, null, 2));
  }
  console.log(`✓ ${renamed.size} images : ${(before / 1e6).toFixed(1)} Mo → ${(after / 1e6).toFixed(1)} Mo. Relancer \`npm run seed\`.`);
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
