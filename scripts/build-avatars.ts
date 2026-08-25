/* eslint-disable no-console */
/**
 * Avatars « personnages » : recadrage sur le visage des screenshots / artworks
 * officiels (`public/media`) → `public/avatars/{id}.jpg` (320 px, versionnés,
 * ~40 Ko pièce) + `src/data/generated/avatars.json`.
 *
 * Les cadrages sont relevés à la main (centre du visage en fractions de
 * l'image, taille de la tête en fraction de la hauteur) : pas de détection de
 * visage, les rendus stylisés la trompent et le résultat doit être irréprochable.
 *
 * Usage : npm run build:avatars
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Jimp } from "jimp";

const ROOT = path.resolve(__dirname, "..");
const MEDIA = path.join(ROOT, "public", "media");
const OUT_DIR = path.join(ROOT, "public", "avatars");
const OUT_JSON = path.join(ROOT, "src", "data", "generated", "avatars.json");
const SIZE = 320;
/** Côté du carré de recadrage = taille de tête × ce facteur (laisse épaules et coiffure). */
const ZOOM = 2.1;

interface CropSpec {
  id: string;
  character: string;
  label: string;
  file: string;
  /** Centre du visage (fractions 0..1 de la largeur / hauteur). */
  cx: number;
  cy: number;
  /** Hauteur de la tête en fraction de la hauteur de l'image. */
  head: number;
}

const CROPS: CropSpec[] = [
  // Jason Duval
  { id: "jason-duval", character: "Jason Duval", label: "Jason — pick-up", file: "screenshots/People/Jason Duval/Jason_Duval_02.jpg", cx: 0.46, cy: 0.3, head: 0.5 },
  { id: "jason-duval-2", character: "Jason Duval", label: "Jason — moto", file: "screenshots/People/Jason Duval/Jason_Duval_01.jpg", cx: 0.65, cy: 0.15, head: 0.26 },
  { id: "jason-duval-3", character: "Jason Duval", label: "Jason — bar", file: "screenshots/People/Jason Duval/Jason_Duval_06.jpg", cx: 0.45, cy: 0.22, head: 0.34 },
  // Lucia Caminos
  { id: "lucia-caminos", character: "Lucia Caminos", label: "Lucia — piscine", file: "screenshots/People/Lucia Caminos/Lucia_Caminos_02.jpg", cx: 0.5, cy: 0.33, head: 0.42 },
  { id: "lucia-caminos-2", character: "Lucia Caminos", label: "Lucia — salle de sport", file: "screenshots/People/Lucia Caminos/Lucia_Caminos_01.jpg", cx: 0.63, cy: 0.22, head: 0.34 },
  { id: "lucia-caminos-3", character: "Lucia Caminos", label: "Lucia — club", file: "screenshots/People/Lucia Caminos/Lucia_Caminos_06.jpg", cx: 0.53, cy: 0.3, head: 0.32 },
  { id: "lucia-caminos-4", character: "Lucia Caminos", label: "Lucia — Leonida Penitentiary", file: "screenshots/People/Lucia Caminos/Lucia_Caminos_05.jpg", cx: 0.6, cy: 0.2, head: 0.28 },
  // Boobie Ike
  { id: "boobie-ike", character: "Boobie Ike", label: "Boobie — gros plan", file: "screenshots/People/Boobie Ike/Boobie_Ike_03.jpg", cx: 0.47, cy: 0.32, head: 0.44 },
  { id: "boobie-ike-2", character: "Boobie Ike", label: "Boobie — artwork", file: "artwork/Boobie_Ike/Boobie_Ike_square.jpg", cx: 0.5, cy: 0.15, head: 0.2 },
  { id: "boobie-ike-3", character: "Boobie Ike", label: "Boobie — Jack of Hearts", file: "screenshots/People/Boobie Ike/Boobie_Ike_02.jpg", cx: 0.33, cy: 0.2, head: 0.28 },
  // Brian Heder
  { id: "brian-heder", character: "Brian Heder", label: "Brian — lunettes", file: "screenshots/People/Brian Heder/Brian_Heder_01.jpg", cx: 0.52, cy: 0.25, head: 0.34 },
  { id: "brian-heder-2", character: "Brian Heder", label: "Brian — artwork", file: "artwork/Brian_Heder/Brian_Heder_square.jpg", cx: 0.5, cy: 0.15, head: 0.19 },
  { id: "brian-heder-3", character: "Brian Heder", label: "Brian — hangar", file: "screenshots/People/Brian Heder/Brian_Heder_03.jpg", cx: 0.57, cy: 0.28, head: 0.34 },
  // Cal Hampton
  { id: "cal-hampton", character: "Cal Hampton", label: "Cal — minigolf", file: "screenshots/People/Cal Hampton/Cal_Hampton_01.jpg", cx: 0.68, cy: 0.12, head: 0.22 },
  { id: "cal-hampton-2", character: "Cal Hampton", label: "Cal — artwork", file: "artwork/Cal_Hampton/Cal_Hampton_square.jpg", cx: 0.5, cy: 0.15, head: 0.2 },
  { id: "cal-hampton-3", character: "Cal Hampton", label: "Cal — piscine", file: "screenshots/People/Cal Hampton/Cal_Hampton_03.jpg", cx: 0.45, cy: 0.22, head: 0.2 },
  // Dre'Quan Priest
  { id: "drequan-priest", character: "Dre'Quan Priest", label: "Dre'Quan — club", file: "screenshots/People/DreQuan Priest/DreQuan_Priest_01.jpg", cx: 0.53, cy: 0.2, head: 0.28 },
  { id: "drequan-priest-2", character: "Dre'Quan Priest", label: "Dre'Quan — artwork", file: "artwork/DreQuan_Priest/DreQuan_Priest_square.jpg", cx: 0.5, cy: 0.15, head: 0.18 },
  { id: "drequan-priest-3", character: "Dre'Quan Priest", label: "Dre'Quan — Dreams", file: "screenshots/People/DreQuan Priest/DreQuan_Priest_02.jpg", cx: 0.72, cy: 0.2, head: 0.28 },
  // Raul Bautista
  { id: "raul-bautista", character: "Raul Bautista", label: "Raul — téléphone", file: "screenshots/People/Raul Bautista/Raul_Bautista_01.jpg", cx: 0.6, cy: 0.28, head: 0.44 },
  { id: "raul-bautista-2", character: "Raul Bautista", label: "Raul — artwork", file: "artwork/Raul_Bautista/Raul_Bautista_square.jpg", cx: 0.5, cy: 0.14, head: 0.16 },
  { id: "raul-bautista-3", character: "Raul Bautista", label: "Raul — yacht", file: "screenshots/People/Raul Bautista/Raul_Bautista_03.jpg", cx: 0.53, cy: 0.12, head: 0.18 },
  // Real Dimez
  { id: "real-dimez", character: "Real Dimez", label: "Real Dimez — studio", file: "screenshots/People/Real Dimez/Real_Dimez_01.jpg", cx: 0.47, cy: 0.15, head: 0.28 },
  { id: "real-dimez-2", character: "Real Dimez", label: "Real Dimez — voiture", file: "screenshots/People/Real Dimez/Real_Dimez_03.jpg", cx: 0.7, cy: 0.32, head: 0.34 },
  { id: "real-dimez-3", character: "Real Dimez", label: "Real Dimez — artwork", file: "artwork/Real_Dimez/Real_Dimez_square.jpg", cx: 0.36, cy: 0.22, head: 0.16 },
  { id: "real-dimez-4", character: "Real Dimez", label: "Real Dimez — artwork II", file: "artwork/Real_Dimez/Real_Dimez_square.jpg", cx: 0.64, cy: 0.2, head: 0.16 },
];

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const out: { id: string; character: string; label: string; src: string }[] = [];
  for (const c of CROPS) {
    const file = path.join(MEDIA, c.file);
    if (!existsSync(file)) {
      console.warn(`  ⚠ absent : ${c.file}`);
      continue;
    }
    const img = await Jimp.read(file);
    const side = Math.round(Math.min(img.height * c.head * ZOOM, img.width, img.height));
    const x = Math.round(Math.min(Math.max(c.cx * img.width - side / 2, 0), img.width - side));
    const y = Math.round(Math.min(Math.max(c.cy * img.height - side * 0.5, 0), img.height - side));
    const avatar = img.crop({ x, y, w: side, h: side }).resize({ w: SIZE, h: SIZE });
    const dest = path.join(OUT_DIR, `${c.id}.jpg`);
    await avatar.write(dest as `${string}.jpg`, { quality: 86 });
    out.push({ id: c.id, character: c.character, label: c.label, src: `/avatars/${c.id}.jpg` });
    console.log(`  ✓ ${c.id}`);
  }
  writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  console.log(`✓ ${out.length} avatars → public/avatars, src/data/generated/avatars.json`);
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
