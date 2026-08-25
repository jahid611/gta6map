/* eslint-disable no-console */
/**
 * Envoie un dossier de `public/` vers un bucket PUBLIC de Supabase Storage
 * (plan gratuit : 1 Go de stockage, 5 Go de sortie / mois — suffisant pour les
 * médias officiels optimisés ; pour un fort trafic, préférer Cloudflare R2 via
 * `npm run assets:upload`).
 *
 * L'app retombe automatiquement sur ce bucket quand `public/media` est absent
 * (Vercel) : voir `src/lib/media-catalog.ts` → `${SUPABASE_URL}/storage/v1/object/public/media`.
 *
 * Usage : npm run media:upload            (public/media → bucket "media")
 *         npm run media:upload -- --dir wiki --bucket wiki
 *         options : --concurrency 6  --force (ré-envoie même si présent)
 * Variables : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local)
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import mime from "mime-types";

loadEnv({ path: ".env.local", quiet: true });

const ROOT = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
const DIR = arg("--dir", "media");
const BUCKET = arg("--bucket", DIR);
const CONCURRENCY = Number(arg("--concurrency", "6"));
const FORCE = argv.includes("--force");
const SOURCE = path.join(ROOT, "public", DIR);
/** Les masters vidéo (5–15 Mo pièce) ne sont pas envoyés : seules les versions `web/` et `posters/` servent au site. */
const SKIP = /^clips\/[^/]+\.mp4$/i;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans .env.local");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

async function ensureBucket(): Promise<void> {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: "50MB" });
  if (error) throw new Error(`createBucket: ${error.message}`);
  console.log(`  bucket public « ${BUCKET} » créé`);
}

async function listExisting(): Promise<Set<string>> {
  // Liste récursive via l'API (par dossier) pour éviter les ré-envois.
  const seen = new Set<string>();
  const dirs = [""];
  while (dirs.length) {
    const prefix = dirs.pop()!;
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
      if (error || !data?.length) break;
      for (const item of data) {
        const p = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id) seen.add(p);
        else dirs.push(p);
      }
      if (data.length < 1000) break;
      offset += 1000;
    }
  }
  return seen;
}

async function main(): Promise<void> {
  if (!existsSync(SOURCE)) throw new Error(`Dossier introuvable : ${path.relative(ROOT, SOURCE)}`);
  await ensureBucket();
  const existing = FORCE ? new Set<string>() : await listExisting();
  const files = [...walk(SOURCE)]
    .map((f) => ({ file: f, key: path.relative(SOURCE, f).split(path.sep).join("/") }))
    .filter(({ key }) => !SKIP.test(key));
  const todo = files.filter(({ key }) => !existing.has(key));
  const total = todo.reduce((s, f) => s + statSync(f.file).size, 0);
  console.log(`▶ ${BUCKET} : ${files.length} fichiers, ${todo.length} à envoyer (${(total / 1e6).toFixed(0)} Mo)`);

  let i = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < todo.length) {
        const { file, key: objectKey } = todo[i++];
        try {
          const body = await readFile(file);
          const { error } = await supabase.storage.from(BUCKET).upload(objectKey, body, {
            contentType: mime.lookup(file) || "application/octet-stream",
            cacheControl: "31536000",
            upsert: true,
          });
          if (error) throw new Error(error.message);
          done += 1;
          if (done % 25 === 0 || done === todo.length) console.log(`  ${done}/${todo.length}`);
        } catch (err) {
          console.warn(`  ⚠ ${objectKey}: ${err instanceof Error ? err.message : err}`);
        }
      }
    }),
  );
  console.log(`✓ ${done} envoyés → ${url}/storage/v1/object/public/${BUCKET}/…`);
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
