/**
 * Extrait en SVG les glyphes Flaticon UIcons utilisés par le site.
 *
 * Le paquet `@flaticon/flaticon-uicons` ne livre que des fontes-icônes : 252 Ko
 * de WOFF2 qui embarquent les 3 568 glyphes du jeu, qu'on en utilise 5 ou 500.
 * Une fonte-icône a par ailleurs les défauts d'un texte — elle hérite de la
 * taille de police au lieu de sa boîte, disparaît si la fonte échoue, et ne sait
 * pas prendre `currentColor` autrement que comme couleur de texte.
 *
 * On extrait donc une fois pour toutes les contours des seules icônes citées
 * dans `ICONS`, et on génère de vrais composants SVG : quelques kilo-octets,
 * dimensionnés par `h-4 w-4` comme n'importe quel SVG, et colorés par
 * `currentColor`. Le dessin reste celui de Flaticon (attribution au pied de page).
 *
 * Usage : npm run build:icons — à relancer après avoir ajouté un nom à `ICONS`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import opentype from "opentype.js";

const ROOT = path.resolve(__dirname, "..");
const PKG = path.join(ROOT, "node_modules", "@flaticon", "flaticon-uicons");
const CSS = path.join(PKG, "css", "solid", "straight.css");
const FONT = path.join(PKG, "css", "uicons-solid-straight-ITFA7HIK.woff");
const OUT = path.join(ROOT, "src", "components", "ui", "icons.generated.ts");

/**
 * Correspondance « nom employé dans le code » → « nom Flaticon ».
 *
 * Les clés reprennent les noms Lucide déjà utilisés partout : le remplacement
 * se limite alors à changer la ligne d'import de chaque fichier, sans toucher
 * au JSX. Les valeurs sont les icônes `fi-ss-*` du jeu Solid Straight.
 */
const ICONS: Readonly<Record<string, string>> = {
  // Navigation & interface
  ArrowLeft: "arrow-left",
  ArrowRight: "arrow-right",
  ArrowUpRight: "arrow-up-right",
  ChevronDown: "angle-down",
  ChevronLeft: "angle-left",
  ChevronRight: "angle-right",
  CornerDownLeft: "arrow-turn-down-left",
  X: "cross-small",
  Check: "check",
  Search: "search",
  PanelLeft: "sidebar",
  SlidersHorizontal: "settings-sliders",
  ExternalLink: "arrow-up-right-from-square",
  Loader2: "spinner",
  Minus: "minus",
  Plus: "plus",
  RotateCcw: "rotate-left",
  Eye: "eye",
  EyeOff: "eye-crossed",
  Type: "text",
  Grid3x3: "grid",
  Layers: "layers",
  Crosshair: "location-crosshairs",
  // `cardinal-compass` est une rose des vents : à 16 px elle se lit comme une
  // étoile. `compass-alt` est la boussole à cadran et aiguille, reconnaissable.
  Compass: "compass-alt",
  Trophy: "trophy",
  Cloud: "cloud",
  CloudOff: "cloud-disabled",
  LogIn: "sign-in-alt",
  LogOut: "sign-out-alt",
  Mail: "envelope",
  BookOpen: "book-open-cover",
  CheckCircle2: "check-circle",
  MapPin: "marker",
  Pin: "thumbtack",
  Camera: "camera",
  Copy: "copy",
  Database: "database",
  Link2: "link",
  LocateFixed: "location-crosshairs",
  Maximize2: "expand",
  Download: "download",
  Ruler: "ruler-combined",

  // Catégories de la carte (champ `icon` des catégories)
  Building2: "building",
  Car: "car-side",
  Clapperboard: "clapperboard-play",
  Egg: "egg",
  Factory: "industry-windows",
  Film: "film",
  Flag: "flag",
  Fuel: "gas-pump",
  Gem: "gem",
  Home: "home",
  Hotel: "hotel",
  Landmark: "bank",
  Mountain: "mountains",
  Palmtree: "island-tropical",
  PartyPopper: "party-horn",
  Plane: "plane",
  RadioTower: "signal-alt-1",
  Road: "road",
  Star: "star",
  Store: "shop",
  TreePine: "tree",
  Utensils: "utensils",
};

/** Table `nom Flaticon → point de code` lue dans la feuille de style du jeu. */
function readCodepoints(): Map<string, number> {
  const css = readFileSync(CSS, "utf8");
  const map = new Map<string, number>();
  for (const m of css.matchAll(/\.fi-ss-([a-z0-9-]+):before\{content:"\\([0-9a-f]+)"\}/g)) {
    map.set(m[1], parseInt(m[2], 16));
  }
  return map;
}

function main(): void {
  const codepoints = readCodepoints();
  // `loadSync` est déprécié et renvoie `undefined` sur les versions récentes :
  // on lit le fichier nous-mêmes et on passe le buffer à `parse`.
  const buf = readFileSync(FONT);
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  // Les glyphes sont dessinés dans le carré em de la fonte ; on ramène tout à
  // une boîte 24×24 pour se substituer aux SVG Lucide sans retoucher le JSX.
  const scale = 24 / font.unitsPerEm;
  const baseline = font.ascender * scale;

  const entries: string[] = [];
  const missing: string[] = [];

  for (const [component, flaticonName] of Object.entries(ICONS)) {
    const code = codepoints.get(flaticonName);
    if (code === undefined) {
      missing.push(`${component} → fi-ss-${flaticonName} (nom inconnu)`);
      continue;
    }
    const glyph = font.charToGlyph(String.fromCodePoint(code));
    // `getPath` place l'origine sur la ligne de base et l'axe y vers le haut ;
    // on translate de l'ascendante pour revenir au coin haut-gauche du SVG.
    const p = glyph.getPath(0, baseline, 24);
    const d = p.toPathData(3);
    if (!d) {
      missing.push(`${component} → fi-ss-${flaticonName} (glyphe vide)`);
      continue;
    }
    entries.push(`  ${component}: ${JSON.stringify(d)},`);
  }

  if (missing.length) {
    console.error("Icônes non résolues :\n  " + missing.join("\n  "));
    process.exit(1);
  }

  const header = `/**
 * GÉNÉRÉ PAR \`npm run build:icons\` — NE PAS MODIFIER À LA MAIN.
 *
 * Contours des icônes Flaticon UIcons (jeu Solid Straight) utilisées par le
 * site, ramenés à une boîte 24×24. Voir \`scripts/build-icons.ts\` pour le
 * pourquoi de l'extraction et la table de correspondance des noms.
 *
 * Icônes par Flaticon — https://www.flaticon.com/uicons (licence Flaticon,
 * attribution requise : voir le pied de page du site).
 */
export const ICON_PATHS = {
`;

  writeFileSync(OUT, `${header}${entries.join("\n")}\n} as const;\n\nexport type IconName = keyof typeof ICON_PATHS;\n`);
  console.log(`→ ${path.relative(ROOT, OUT)} — ${entries.length} icônes`);
}

main();
