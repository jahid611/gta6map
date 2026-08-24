/* eslint-disable no-console */
/**
 * Récupération des sources distantes (idempotent, reprise possible) :
 *
 *  1. map.gtadb.org — landmarks.json (≈1 500 lieux, ids `L…`) + photos in-game / réelles
 *     → data/raw/gtadb-landmarks.json, public/photos/gtadb/{id}-{ig|rl}.jpg
 *  2. gtamaplib (rolux) — gtamapdata.py : caméras triangulées des trailers officiels (T1/T2)
 *     et screenshots officiels (S2/S3) + sections de carte. Les caméras `L…` (fuites) sont EXCLUES.
 *     → data/raw/cameras.json, data/raw/map-sections.json
 *
 * Usage : npm run fetch:sources [-- --no-photos] [--concurrency 12]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "raw");
const PHOTOS_DIR = path.join(ROOT, "public", "photos", "gtadb");

const GTADB_BASE = "https://map.gtadb.org";
const GTAMAPDATA_URL = "https://raw.githubusercontent.com/rolux/gtamaplib/main/gtamapdata.py";
const UA = "gta6map-fetch/1.0 (+https://github.com/rolux/gtadb.org mirror for a fan map)";

const argv = process.argv.slice(2);
const SKIP_PHOTOS = argv.includes("--no-photos");
const cIdx = argv.indexOf("--concurrency");
const CONCURRENCY = cIdx >= 0 ? Number(argv[cIdx + 1]) : 12;

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

export interface CameraRecord {
  /** ex. `T1/12`, `S2/3` */
  id: string;
  /** `T1` | `T2` | `S2` | `S3` */
  group: string;
  name: string;
  player: [number, number, number] | null;
  xyz: [number, number, number];
  /** yaw, pitch, roll (degrés) */
  ypr: [number, number, number];
  /** hfov, vfov (degrés, null si inconnu) */
  fov: [number | null, number | null];
  size: [number, number];
  /** ex. `Trailer 1 [81]`, `Jason Duval 02 [1]` */
  source: string;
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function pool<T>(items: T[], worker: (item: T) => Promise<void>, concurrency: number): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (i < items.length) {
        const item = items[i++];
        try {
          await worker(item);
        } catch (err) {
          console.warn("  ⚠", err instanceof Error ? err.message : err);
        }
      }
    }),
  );
}

// ───────────────────────── gtadb landmarks + photos ─────────────────────────

async function fetchGtadb(): Promise<void> {
  console.log("▶ map.gtadb.org / landmarks.json");
  const buf = await fetchBuffer(`${GTADB_BASE}/data/6/landmarks.json`);
  writeFileSync(path.join(RAW_DIR, "gtadb-landmarks.json"), buf);
  const data = JSON.parse(buf.toString("utf8")) as Record<string, GtadbRow>;
  const ids = Object.keys(data);
  console.log(`  ✓ ${ids.length} landmarks`);
  if (SKIP_PHOTOS) return;

  mkdirSync(PHOTOS_DIR, { recursive: true });
  const jobs: { id: string; kind: "ig" | "rl"; version: number }[] = [];
  for (const id of ids) {
    const row = data[id];
    if (row[1].length !== 2) continue; // sans coordonnées ⇒ pas affiché
    if (row[2].length === 2) jobs.push({ id, kind: "ig", version: row[8][1] });
    if (row[5].length === 2) jobs.push({ id, kind: "rl", version: row[8][2] });
  }
  const pending = jobs.filter((j) => !existsSync(path.join(PHOTOS_DIR, `${j.id}-${j.kind}.jpg`)));
  console.log(`▶ photos : ${jobs.length} au total, ${pending.length} à télécharger`);
  let done = 0;
  await pool(
    pending,
    async (j) => {
      const b = await fetchBuffer(`${GTADB_BASE}/photos/6/${j.id},${j.kind}.jpg?v=${j.version}`);
      writeFileSync(path.join(PHOTOS_DIR, `${j.id}-${j.kind}.jpg`), b);
      done += 1;
      if (done % 100 === 0) console.log(`  ${done}/${pending.length}`);
    },
    CONCURRENCY,
  );
  console.log(`  ✓ ${done} photos`);
}

// ───────────────────────── gtamapdata (caméras officielles) ─────────────────────────

function parseTuple(text: string): (number | null)[] {
  return text.split(",").map((s) => {
    const t = s.trim().replace(/_/g, "");
    if (t === "" || t === "None") return null;
    return Number(t);
  });
}

/** Parse le dictionnaire Python `cameras` (une entrée par ligne) sans exécuter Python. */
export function parseCameras(source: string): CameraRecord[] {
  const lines = source.split("\n");
  const out: CameraRecord[] = [];
  const seen = new Set<string>();
  const re =
    /^\s*"\[([A-Z]\d?)\/(\d+)\] ([^"]+)":\s*\((None|\(([^)]*)\)),\s*\(([^)]*)\),\s*\(([^)]*)\),\s*\(([^)]*)\),\s*\(([^)]*)\),\s*"([^"]*)"\)/;
  for (const raw of lines) {
    if (raw.trim().startsWith("#")) continue;
    const m = re.exec(raw);
    if (!m) continue;
    const [, group, num, name, playerRaw, playerInner, xyzRaw, yprRaw, fovRaw, sizeRaw, sourceRaw] = m;
    if (group.startsWith("L")) continue; // fuites : exclues
    const key = `${group}/${num} ${name}`;
    if (seen.has(key)) continue; // la dernière définition non commentée gagne dans Python ; ici on garde la 1re non commentée
    seen.add(key);
    const xyz = parseTuple(xyzRaw);
    if (xyz.length !== 3 || xyz.some((v) => v === null)) continue;
    const player = playerRaw === "None" ? null : (parseTuple(playerInner ?? "") as [number, number, number]);
    const ypr = parseTuple(yprRaw) as [number, number, number];
    const fov = parseTuple(fovRaw) as [number | null, number | null];
    const size = parseTuple(sizeRaw) as [number, number];
    out.push({
      id: `${group}/${num}`,
      group,
      name,
      player,
      xyz: xyz as [number, number, number],
      ypr,
      fov,
      size,
      source: sourceRaw,
    });
  }
  return out;
}

export function parseMapSections(source: string): Record<string, [number, number, number, number]> {
  const start = source.indexOf("map_sections = {");
  const end = source.indexOf("}", start);
  const block = source.slice(start, end);
  const out: Record<string, [number, number, number, number]> = {};
  const re = /"([^"]+)":\s*\((-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])];
  return out;
}

async function fetchGtamapdata(): Promise<void> {
  console.log("▶ gtamaplib / gtamapdata.py");
  const local = path.join(RAW_DIR, "gtamapdata.py");
  let source: string;
  try {
    source = (await fetchBuffer(GTAMAPDATA_URL)).toString("utf8");
    writeFileSync(local, source);
  } catch (err) {
    if (!existsSync(local)) throw err;
    console.warn("  ⚠ téléchargement impossible, utilisation de la copie locale");
    source = readFileSync(local, "utf8");
  }
  const cameras = parseCameras(source);
  const byGroup = cameras.reduce<Record<string, number>>((a, c) => ((a[c.group] = (a[c.group] ?? 0) + 1), a), {});
  writeFileSync(path.join(RAW_DIR, "cameras.json"), JSON.stringify(cameras, null, 2));
  console.log(`  ✓ ${cameras.length} caméras officielles triangulées`, byGroup);
  const sections = parseMapSections(source);
  writeFileSync(path.join(RAW_DIR, "map-sections.json"), JSON.stringify(sections, null, 2));
  console.log(`  ✓ ${Object.keys(sections).length} sections de carte`);
}

async function main(): Promise<void> {
  mkdirSync(RAW_DIR, { recursive: true });
  await fetchGtamapdata();
  await fetchGtadb();
  console.log("✓ Sources à jour");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("✗", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
