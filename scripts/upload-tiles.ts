/* eslint-disable no-console */
/**
 * Upload des tuiles et photos vers un bucket S3-compatible (Cloudflare R2, AWS S3…).
 * Les objets sont envoyés avec `Cache-Control: public, max-age=31536000, immutable`
 * (les dossiers de tuiles sont versionnés : `dupzor,51`, `yanis,6`…).
 *
 * Variables d'env (.env.local) :
 *   S3_ENDPOINT            ex. https://<account-id>.r2.cloudflarestorage.com
 *   S3_REGION              ex. auto (R2) / eu-west-3 (AWS)
 *   S3_BUCKET              nom du bucket
 *   S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY
 *   S3_PREFIX              préfixe optionnel (ex. gta6)
 *
 * Dossiers envoyés : tiles, photos, frames, wiki, media.
 *
 * Usage : npm run assets:upload [-- --tiles-only | --photos-only] [--concurrency 16]
 */
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PutObjectCommand, S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import mime from "mime-types";

loadEnv({ path: ".env.local" });

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");

const argv = process.argv.slice(2);
const TILES_ONLY = argv.includes("--tiles-only");
const PHOTOS_ONLY = argv.includes("--photos-only");
const concurrencyIdx = argv.indexOf("--concurrency");
const CONCURRENCY = concurrencyIdx >= 0 ? Number(argv[concurrencyIdx + 1]) : 16;

const { S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
const PREFIX = (process.env.S3_PREFIX ?? "").replace(/^\/+|\/+$/g, "");

if (!S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
  console.error("✗ Variables S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY manquantes.");
  process.exit(1);
}

const s3 = new S3Client({
  region: S3_REGION ?? "auto",
  endpoint: S3_ENDPOINT,
  forcePathStyle: !!S3_ENDPOINT,
  credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
});

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

async function exists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function upload(file: string): Promise<"uploaded" | "skipped"> {
  const rel = path.relative(PUBLIC_DIR, file).split(path.sep).join("/");
  const key = PREFIX ? `${PREFIX}/${rel}` : rel;
  if (await exists(key)) return "skipped";
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: createReadStream(file),
      ContentType: mime.lookup(file) || "application/octet-stream",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return "uploaded";
}

async function runPool(files: string[]): Promise<void> {
  let index = 0;
  let uploaded = 0;
  let skipped = 0;
  const worker = async (): Promise<void> => {
    while (index < files.length) {
      const file = files[index++];
      const result = await upload(file);
      if (result === "uploaded") uploaded += 1;
      else skipped += 1;
      if ((uploaded + skipped) % 100 === 0) {
        console.log(`  ${uploaded + skipped}/${files.length} (↑ ${uploaded}, ↷ ${skipped})`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`✓ ${uploaded} envoyés, ${skipped} déjà présents`);
}

async function main(): Promise<void> {
  const targets: string[] = [];
  if (!PHOTOS_ONLY) targets.push(path.join(PUBLIC_DIR, "tiles"));
  if (!TILES_ONLY) {
    targets.push(
      path.join(PUBLIC_DIR, "photos"),
      path.join(PUBLIC_DIR, "frames"),
      path.join(PUBLIC_DIR, "wiki"),
      // `media` : screenshots, artworks et clips de la galerie. Le dossier pese
      // ~384 Mo — il ne peut pas partir dans le depot, et sans lui la galerie
      // n'a rien a afficher en production.
      path.join(PUBLIC_DIR, "media"),
    );
  }
  const files = targets.filter(existsSync).flatMap((dir) => [...walk(dir)]);
  console.log(`▶ Upload de ${files.length} fichiers vers ${S3_BUCKET}/${PREFIX || ""}`);
  await runPool(files);
}

main().catch((err) => {
  console.error("✗ Upload échoué :", err instanceof Error ? err.message : err);
  process.exit(1);
});
