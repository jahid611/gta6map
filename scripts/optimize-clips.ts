/**
 * Produit des versions web des clips vidéo, et leur affiche.
 *
 * Les fichiers livrés par Rockstar sont des masters, pas des vidéos web : des
 * boucles d'une seconde en 4K à 47–128 Mb/s, soit 5 à 15 Mo pièce. Les servir
 * tels quels obligeait le navigateur à télécharger 15 Mo et à décoder de la 4K
 * pour peindre une vignette de 400 px — c'est là qu'était la lenteur.
 *
 * On génère donc, à côté de chaque master :
 *  - `web/<nom>.mp4` : 1440 px de côté maximum, H.264 CRF 23, `+faststart`
 *    (index en tête, pour que la lecture démarre sans attendre le fichier entier) ;
 *  - `posters/<nom>.jpg` : une image fixe, indispensable à une vignette
 *    `preload="none"` qui n'a sinon rien à afficher.
 *
 * Les masters restent intacts : le transcodage est reproductible, eux non.
 *
 * Usage : npm run optimize:clips
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

const ROOT = path.resolve(__dirname, "..");
const CLIPS = path.join(ROOT, "public", "media", "clips");
const WEB = path.join(CLIPS, "web");
const POSTERS = path.join(CLIPS, "posters");

/** Côté le plus long des versions web, en pixels. */
const MAX_SIDE = 1440;

function run(args: string[]): void {
  execFileSync(ffmpegPath as string, ["-y", "-loglevel", "error", ...args], { stdio: "pipe" });
}

function mb(file: string): number {
  return statSync(file).size / 1048576;
}

function main(): void {
  if (!existsSync(CLIPS)) {
    console.log("Aucun dossier de clips — rien à faire.");
    return;
  }
  if (!ffmpegPath) {
    console.error("ffmpeg introuvable (paquet ffmpeg-static).");
    process.exit(1);
  }

  mkdirSync(WEB, { recursive: true });
  mkdirSync(POSTERS, { recursive: true });

  const files = readdirSync(CLIPS).filter((f) => f.toLowerCase().endsWith(".mp4"));
  let totalBefore = 0;
  let totalAfter = 0;

  for (const name of files) {
    const src = path.join(CLIPS, name);
    const web = path.join(WEB, name);
    const poster = path.join(POSTERS, name.replace(/\.mp4$/i, ".jpg"));

    if (!existsSync(web)) {
      run([
        "-i", src,
        // `-2` conserve le rapport d'image en gardant une dimension paire, que
        // H.264 exige. `force_original_aspect_ratio=decrease` évite d'agrandir
        // un clip déjà plus petit que la cible.
        "-vf", `scale=${MAX_SIDE}:${MAX_SIDE}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
        "-c:v", "libx264",
        "-crf", "23",
        "-preset", "slow",
        "-pix_fmt", "yuv420p",
        "-an", // pistes audio muettes ou absentes : inutile de les transporter
        "-movflags", "+faststart",
        web,
      ]);
    }

    if (!existsSync(poster)) {
      // À 0,3 s plutôt qu'à 0 : la première image est souvent un fondu au noir.
      // Les clips durant 1 s, un `-ss 1` tomberait après la fin.
      run(["-ss", "0.3", "-i", web, "-frames:v", "1", "-q:v", "4", poster]);
    }

    const before = mb(src);
    const after = mb(web);
    totalBefore += before;
    totalAfter += after;
    console.log(
      `  ✓ ${name.padEnd(38)} ${before.toFixed(1).padStart(5)} → ${after.toFixed(2).padStart(5)} Mo ` +
        `(−${(100 - (after / before) * 100).toFixed(0)} %)  affiche ${(statSync(poster).size / 1024).toFixed(0)} Ko`,
    );
  }

  console.log(
    `\n${files.length} clip(s) : ${totalBefore.toFixed(1)} Mo → ${totalAfter.toFixed(1)} Mo ` +
      `(−${(100 - (totalAfter / totalBefore) * 100).toFixed(0)} %).`,
  );
}

main();
