/**
 * Vérifie les quartiers du mode piéton sans passer par le navigateur.
 *
 * La géométrie est construite en mémoire pure — three.js n'a besoin d'un canvas
 * que pour dessiner, pas pour calculer. On peut donc contrôler ici ce qu'un
 * coup d'œil à l'écran ne dirait pas : un contour qui produit des `NaN`, une
 * couche restée vide après une regénération, un immeuble dans lequel on
 * pourrait entrer, ou une correspondance avec la carte du jeu qui a dérivé.
 *
 *   npx tsx scripts/check-world.ts
 */
import type { BufferGeometry } from "three";
import { applyGameTransform, buildBuildings, buildGround, CollisionGrid, fitGameTransform } from "@/lib/street/build";
import type { StreetWorld } from "@/types/street";

import viceBeach from "@/data/generated/world/vice-beach.json";
import viceCityDowntown from "@/data/generated/world/vice-city-downtown.json";

const WORLDS = [viceBeach, viceCityDowntown] as unknown as StreetWorld[];

let failures = 0;

function fail(message: string) {
  failures++;
  console.log(`  ✗ ${message}`);
}

function layer(name: string, geometry: BufferGeometry | null, expectNonEmpty = true) {
  if (!geometry) {
    if (expectNonEmpty) fail(`couche « ${name} » vide`);
    else console.log(`  ${name.padEnd(11)} vide`);
    return;
  }
  const position = geometry.attributes.position;
  const array = position.array as Float32Array;
  let nan = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < array.length; i++) {
    if (!Number.isFinite(array[i])) nan++;
    else if (i % 3 === 1) {
      minY = Math.min(minY, array[i]);
      maxY = Math.max(maxY, array[i]);
    }
  }
  console.log(
    `  ${name.padEnd(11)} ${String(position.count).padStart(7)} sommets · ` +
      `${String((geometry.index?.count ?? 0) / 3).padStart(7)} triangles · ` +
      `y ∈ [${minY.toFixed(2)}, ${maxY.toFixed(2)}]`,
  );
  if (nan) fail(`${nan} coordonnées non finies dans « ${name} »`);
  if (!geometry.attributes.colorVi) fail(`« ${name} » n'a pas d'attribut colorVi`);
}

for (const world of WORLDS) {
  console.log(`\n> ${world.name}`);
  const started = Date.now();
  const buildings = buildBuildings(world.buildings);
  const ground = buildGround(world);
  console.log(`  construit en ${Date.now() - started} ms`);

  layer("murs", buildings.walls);
  layer("toits", buildings.roofs);
  layer("néons", buildings.neon);
  layer("bitume", ground.asphalt);
  layer("trottoirs", ground.pavement);
  layer("marquage", ground.markings);
  layer("eau", ground.water, false);
  layer("sable", ground.sand, false);
  layer("verdure", ground.green, false);

  const withPhoto = world.spots.filter((s) => s.ig ?? s.irl).length;
  console.log(`  ${buildings.anchors.length} façades porteuses de photo (${withPhoto} lieux illustrés)`);
  if (!buildings.anchors.length) fail("aucune façade ne porte de photo");

  // ── Collisions ────────────────────────────────────────────────────────────
  const grid = new CollisionGrid(world.buildings);
  const [sx, sz] = grid.resolve(world.spawn.x, world.spawn.z, 0.45);
  const moved = Math.hypot(sx - world.spawn.x, sz - world.spawn.z);
  console.log(`  point d'apparition déplacé de ${moved.toFixed(2)} m par les collisions`);
  if (moved > 2) fail("le point d'apparition tombe dans un mur");

  // Le centre d'un immeuble doit toujours être expulsé : sinon on marcherait
  // à l'intérieur.
  let trapped = 0;
  const sample = world.buildings.slice(0, 400);
  for (const building of sample) {
    let cx = 0;
    let cz = 0;
    const n = building.p.length / 2;
    for (let i = 0; i < n; i++) {
      cx += building.p[i * 2];
      cz += building.p[i * 2 + 1];
    }
    cx /= n;
    cz /= n;
    const [rx, rz] = grid.resolve(cx, cz, 0.45);
    if (Math.hypot(rx - cx, rz - cz) < 0.01) trapped++;
  }
  console.log(`  ${sample.length - trapped}/${sample.length} centres d'immeubles repoussés`);
  if (trapped > sample.length * 0.35) fail(`${trapped} immeubles traversables`);

  // ── Correspondance avec la carte du jeu ───────────────────────────────────
  const transform = fitGameTransform(world.spots);
  if (!transform) {
    fail("correspondance avec la carte du jeu impossible");
  } else {
    const errors = world.spots
      .map((spot) => {
        const [gx, gy] = applyGameTransform(transform, spot.x, spot.z);
        return Math.hypot(gx - spot.gx, gy - spot.gy);
      })
      .sort((a, b) => a - b);
    const p90 = Math.round(errors[Math.floor(errors.length * 0.9)]);
    console.log(
      `  carte du jeu : échelle ${transform.scale.toFixed(3)} · rotation ${transform.rotation.toFixed(1)}° · ` +
        `erreur médiane ${transform.error} m (p90 ${p90} m) sur ${transform.samples} lieux`,
    );
    if (transform.error > 400) fail("la correspondance avec la carte du jeu a dérivé");
  }
}

console.log(
  failures ? `\n${failures} problème(s) détecté(s)` : "\nOK — les quartiers sont exploitables",
);
process.exit(failures ? 1 : 0);
