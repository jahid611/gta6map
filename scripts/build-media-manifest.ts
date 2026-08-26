/**
 * Indexe les médias officiels déposés dans `public/media` et écrit
 * `src/data/generated/media.json`.
 *
 * Le dossier `public/media` est ignoré par git, comme les autres dossiers
 * d'assets du projet (`tiles`, `frames`, `photos`…) : trop volumineux pour un
 * dépôt, et reconstituable. Le manifeste, lui, est versionné — la galerie sait
 * alors ce qu'elle devrait afficher même sur un poste où les fichiers ne sont
 * pas encore là, et le rendu dégrade proprement plutôt que de casser.
 *
 * Usage : npm run build:media — à relancer après avoir ajouté des fichiers.
 */
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const MEDIA = path.join(ROOT, "public", "media");
const OUT = path.join(ROOT, "src", "data", "generated", "media.json");

export type MediaKind = "screenshot" | "artwork" | "clip";

interface MediaEntry {
  id: string;
  kind: MediaKind;
  /** Regroupement affiché : « Vice City », « Jason Duval »… */
  group: string;
  /** Sous-groupe pour les screenshots : « People » ou « Places ». */
  section: string | null;
  title: string;
  src: string;
  /** Variantes de format d'un artwork (portrait, ultrawide…), hors `src`. */
  variants: string[];
  /** Image fixe d'un clip. `null` pour les autres types. */
  poster: string | null;
}

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const VIDEO_EXT = /\.mp4$/i;

/** « Vice_City_09.jpg » → « Vice City 09 ». */
function titleFromFile(file: string): string {
  return path
    .basename(file)
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Chemin public, séparateurs normalisés (Windows). */
function publicPath(full: string): string {
  return "/" + path.relative(path.join(ROOT, "public"), full).split(path.sep).join("/");
}

function collectScreenshots(): MediaEntry[] {
  const base = path.join(MEDIA, "screenshots");
  return walk(base)
    .filter((f) => IMAGE_EXT.test(f))
    .map((full) => {
      const rel = path.relative(base, full).split(path.sep);
      // « People/Jason Duval/Jason_Duval_01.jpg » → section, groupe, fichier
      const [section, group] = rel.length >= 3 ? [rel[0], rel[1]] : [null, rel[0]];
      return {
        id: publicPath(full),
        kind: "screenshot" as const,
        group: group ?? "Divers",
        section,
        title: titleFromFile(full),
        src: publicPath(full),
        variants: [],
        poster: null,
      };
    });
}

/**
 * Un artwork existe en plusieurs formats du même visuel. On n'en expose qu'une
 * entrée — la version paysage, seule utile en grille — et on garde les autres en
 * variantes plutôt que d'inonder la galerie de six fois la même image.
 */
function collectArtwork(): MediaEntry[] {
  const base = path.join(MEDIA, "artwork");
  if (!existsSync(base)) return [];

  // Un dossier d'artwork peut contenir des SOUS-dossiers (`Postcards/Vice_City`…) :
  // chacun est un visuel distinct. Sans ce découpage, les six cartes postales des
  // régions étaient repliées en une seule entrée « Postcards » et cinq d'entre
  // elles disparaissaient de la galerie comme des illustrations de région.
  function subjects(dir: string, trail: string[]): { trail: string[]; files: string[] }[] {
    const entries = readdirSync(dir);
    const dirs = entries.filter((e) => statSync(path.join(dir, e)).isDirectory());
    if (dirs.length) return dirs.flatMap((d) => subjects(path.join(dir, d), [...trail, d]));
    return [{ trail, files: entries.map((f) => path.join(dir, f)).filter((f) => IMAGE_EXT.test(f)) }];
  }

  return subjects(base, [])
    .filter(({ files }) => files.length > 0)
    .map(({ trail, files }) => {
      const preferred =
        files.find((f) => /landscape/i.test(f)) ?? files.find((f) => /ultrawide/i.test(f)) ?? files[0];
      const clean = (s: string) => s.replace(/[_-]+/g, " ");
      // « Postcards/Vice_City » → groupe « Postcards », titre « Vice City ».
      const group = clean(trail[0]);
      const title = clean(trail[trail.length - 1]);
      return {
        id: publicPath(preferred),
        kind: "artwork" as const,
        group,
        section: trail.length > 1 ? title : null,
        title,
        src: publicPath(preferred),
        variants: files.filter((f) => f !== preferred).map(publicPath),
        poster: null,
      };
    });
}

/**
 * Clips vidéo. On indexe les masters posés à la racine de `clips/` — sans
 * descendre dans `web/` ni `posters/`, qui contiennent les dérivés du même
 * fichier — puis on pointe `src` sur la version web quand elle existe.
 */
function collectClips(): MediaEntry[] {
  const base = path.join(MEDIA, "clips");
  if (!existsSync(base)) return [];

  return readdirSync(base)
    .filter((f) => VIDEO_EXT.test(f) && statSync(path.join(base, f)).isFile())
    .map((name) => {
      const master = path.join(base, name);
      const web = path.join(base, "web", name);
      const poster = path.join(base, "posters", name.replace(/\.mp4$/i, ".jpg"));
      const label = titleFromFile(name).replace(/\s*Video Clip$/i, "");
      return {
        id: publicPath(master),
        kind: "clip" as const,
        group: label,
        section: null,
        title: label,
        src: publicPath(existsSync(web) ? web : master),
        variants: [],
        poster: existsSync(poster) ? publicPath(poster) : null,
      };
    });
}

function main(): void {
  const entries = [...collectScreenshots(), ...collectArtwork(), ...collectClips()].sort((a, b) =>
    a.group.localeCompare(b.group, "fr") || a.title.localeCompare(b.title, "fr"),
  );

  const counts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.kind] = (acc[e.kind] ?? 0) + 1;
    return acc;
  }, {});

  writeFileSync(OUT, JSON.stringify(entries, null, 2) + "\n");
  console.log(
    `→ ${path.relative(ROOT, OUT)} — ${entries.length} entrées ` +
      Object.entries(counts)
        .map(([k, v]) => `${v} ${k}`)
        .join(", "),
  );
}

main();
