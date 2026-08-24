/* eslint-disable no-console */
/**
 * Extraction ciblée des frames de trailers / screenshots officiels depuis
 * `https://gtadb.org/gtamaplib/frames.zip` (1,5 Go) SANS télécharger l'archive :
 * lecture du répertoire central par HTTP Range, puis téléchargement de chaque
 * entrée nécessaire (PNG 4K) → redimensionnement en JPEG (1600 px + vignette 480 px).
 *
 * Seules les caméras officielles (T1/T2 = trailers, S2/S3 = screenshots Rockstar)
 * listées dans data/raw/cameras.json sont extraites. Aucune image de fuite.
 *
 * Usage : npm run fetch:frames [-- --concurrency 3] [--width 1600]
 * Pré-requis : npm run fetch:sources (génère cameras.json)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { Jimp } from "jimp";
import type { CameraRecord } from "./fetch-sources";
import { slugify } from "../src/lib/utils";

const ROOT = path.resolve(__dirname, "..");
const CAMERAS_PATH = path.join(ROOT, "data", "raw", "cameras.json");
const OUT_DIR = path.join(ROOT, "public", "frames");
const INDEX_PATH = path.join(ROOT, "data", "raw", "frames-index.json");
const ZIP_URL = "https://gtadb.org/gtamaplib/frames.zip";

const argv = process.argv.slice(2);
const cIdx = argv.indexOf("--concurrency");
const CONCURRENCY = cIdx >= 0 ? Number(argv[cIdx + 1]) : 3;
const wIdx = argv.indexOf("--width");
const WIDTH = wIdx >= 0 ? Number(argv[wIdx + 1]) : 1600;
const THUMB_WIDTH = 480;

interface ZipEntry {
  name: string;
  method: number;
  csize: number;
  usize: number;
  offset: number;
}

async function rangeFetch(start: number, end: number): Promise<Buffer> {
  const res = await fetch(ZIP_URL, { headers: { Range: `bytes=${start}-${end}` } });
  if (res.status !== 206) throw new Error(`Range non supporté (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function contentLength(): Promise<number> {
  const res = await fetch(ZIP_URL, { method: "HEAD" });
  const len = Number(res.headers.get("content-length"));
  if (!len) throw new Error("Content-Length manquant");
  return len;
}

/** Lit le répertoire central (ZIP / ZIP64) et retourne les entrées. */
async function readCentralDirectory(): Promise<ZipEntry[]> {
  const size = await contentLength();
  const tail = await rangeFetch(Math.max(0, size - 1_000_000), size - 1);
  const tailStart = size - tail.length;
  let cdOff: number;
  let cdSize: number;
  const loc64 = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x07]));
  if (loc64 >= 0) {
    const eocd64 = Number(tail.readBigUInt64LE(loc64 + 8)) - tailStart;
    cdSize = Number(tail.readBigUInt64LE(eocd64 + 40));
    cdOff = Number(tail.readBigUInt64LE(eocd64 + 48));
  } else {
    const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    cdSize = tail.readUInt32LE(eocd + 12);
    cdOff = tail.readUInt32LE(eocd + 16);
  }
  const cd = await rangeFetch(cdOff, cdOff + cdSize - 1);
  const entries: ZipEntry[] = [];
  let p = 0;
  while (p + 46 <= cd.length && cd.readUInt32LE(p) === 0x02014b50) {
    const method = cd.readUInt16LE(p + 10);
    let csize = cd.readUInt32LE(p + 20);
    let usize = cd.readUInt32LE(p + 24);
    const nl = cd.readUInt16LE(p + 28);
    const el = cd.readUInt16LE(p + 30);
    const cl = cd.readUInt16LE(p + 32);
    let offset = cd.readUInt32LE(p + 42);
    const name = cd.toString("utf8", p + 46, p + 46 + nl);
    // Champ extra ZIP64 (0x0001) : valeurs 64 bits pour les champs saturés à 0xFFFFFFFF
    let q = p + 46 + nl;
    const extraEnd = q + el;
    while (q + 4 <= extraEnd) {
      const tag = cd.readUInt16LE(q);
      const len = cd.readUInt16LE(q + 2);
      if (tag === 0x0001) {
        let r = q + 4;
        if (usize === 0xffffffff) {
          usize = Number(cd.readBigUInt64LE(r));
          r += 8;
        }
        if (csize === 0xffffffff) {
          csize = Number(cd.readBigUInt64LE(r));
          r += 8;
        }
        if (offset === 0xffffffff) offset = Number(cd.readBigUInt64LE(r));
      }
      q += 4 + len;
    }
    entries.push({ name, method, csize, usize, offset });
    p += 46 + nl + el + cl;
  }
  return entries;
}

async function extractEntry(entry: ZipEntry): Promise<Buffer> {
  // En-tête local : 30 octets + nom + extra → on lit une marge puis on recalcule.
  const head = await rangeFetch(entry.offset, entry.offset + 29);
  if (head.readUInt32LE(0) !== 0x04034b50) throw new Error(`En-tête local invalide pour ${entry.name}`);
  const nl = head.readUInt16LE(26);
  const el = head.readUInt16LE(28);
  const dataStart = entry.offset + 30 + nl + el;
  const data = await rangeFetch(dataStart, dataStart + entry.csize - 1);
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRawSync(data);
  throw new Error(`Méthode de compression non supportée (${entry.method}) pour ${entry.name}`);
}

export function frameSlug(camera: CameraRecord): string {
  return `${camera.group.toLowerCase()}-${camera.id.split("/")[1]}-${slugify(camera.name)}`;
}

async function main(): Promise<void> {
  if (!existsSync(CAMERAS_PATH)) throw new Error("data/raw/cameras.json manquant — lancer `npm run fetch:sources`");
  const cameras = JSON.parse(readFileSync(CAMERAS_PATH, "utf8")) as CameraRecord[];
  mkdirSync(OUT_DIR, { recursive: true });

  console.log("▶ Lecture du répertoire de frames.zip (HTTP Range)…");
  const entries = await readCentralDirectory();
  const byName = new Map(entries.map((e) => [e.name.replace(/^frames\//, "").replace(/\.png$/i, ""), e]));
  writeFileSync(INDEX_PATH, JSON.stringify(entries.map((e) => e.name), null, 2));
  console.log(`  ${entries.length} entrées`);

  const jobs = cameras
    .map((camera) => ({ camera, entry: byName.get(camera.name), slug: frameSlug(camera) }))
    .filter((j): j is { camera: CameraRecord; entry: ZipEntry; slug: string } => !!j.entry)
    .filter((j) => !existsSync(path.join(OUT_DIR, `${j.slug}.jpg`)));
  const totalMb = jobs.reduce((s, j) => s + j.entry.csize, 0) / 1e6;
  console.log(`▶ ${jobs.length} frames à extraire (${totalMb.toFixed(0)} Mo à télécharger)`);

  let i = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < jobs.length) {
        const job = jobs[i++];
        try {
          const png = await extractEntry(job.entry);
          const image = await Jimp.read(png);
          const large = image.clone().resize({ w: Math.min(WIDTH, image.width) });
          await large.write(path.join(OUT_DIR, `${job.slug}.jpg`) as `${string}.jpg`, { quality: 82 });
          const thumb = image.resize({ w: THUMB_WIDTH });
          await thumb.write(path.join(OUT_DIR, `${job.slug}-thumb.jpg`) as `${string}.jpg`, { quality: 78 });
          done += 1;
          console.log(`  ✓ [${done}/${jobs.length}] ${job.camera.id} ${job.camera.name}`);
        } catch (err) {
          console.warn(`  ⚠ ${job.camera.name}: ${err instanceof Error ? err.message : err}`);
        }
      }
    }),
  );
  console.log(`✓ ${done} frames dans public/frames`);
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
