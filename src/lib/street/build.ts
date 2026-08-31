import * as THREE from "three";
import type { GameTransform, Ring, StreetWorld, WorldBuilding, WorldSpot } from "@/types/street";
import { REAL, VI } from "./ambiance";
import { rng } from "./textures";

/**
 * Construction de la géométrie du quartier.
 *
 * Tout est fusionné en une poignée de maillages : 2 400 immeubles rendus un par
 * un, c'est 2 400 appels de rendu et une carte graphique à genoux ; fusionnés
 * par matériau, c'est cinq. La couleur propre à chaque immeuble ne se perd pas
 * pour autant — elle est portée par les sommets.
 *
 * Chaque sommet porte **deux** couleurs : celle de l'ambiance « vraie vie » et
 * celle de l'ambiance « GTA VI ». La bascule n'est alors qu'un `mix()` dans le
 * nuanceur, sans reconstruire quoi que ce soit — c'est ce qui permet de passer
 * d'un monde à l'autre en pleine course, sans un à-coup.
 */

/** Hauteur d'un niveau, calée sur les UV des textures de façade. */
const STOREY = 3.2;
/** Largeur d'un module de façade (une travée de fenêtres). */
const MODULE = 4;

// ── Accumulateur de maillage ────────────────────────────────────────────────

class MeshBuilder {
  readonly position: number[] = [];
  readonly normal: number[] = [];
  readonly uv: number[] = [];
  readonly colorA: number[] = [];
  readonly colorB: number[] = [];
  readonly index: number[] = [];

  private readonly tmpA = new THREE.Color();
  private readonly tmpB = new THREE.Color();

  get count(): number {
    return this.position.length / 3;
  }

  vertex(
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    u: number,
    v: number,
    a: THREE.Color,
    b: THREE.Color,
  ) {
    this.position.push(x, y, z);
    this.normal.push(nx, ny, nz);
    this.uv.push(u, v);
    this.colorA.push(a.r, a.g, a.b);
    this.colorB.push(b.r, b.g, b.b);
  }

  triangle(a: number, b: number, c: number) {
    this.index.push(a, b, c);
  }

  /** Quad plan, dans l'ordre `p0 → p1 → p2 → p3`. */
  quad(
    points: [number, number, number][],
    normal: [number, number, number],
    uvs: [number, number][],
    a: THREE.Color,
    b: THREE.Color,
  ) {
    const base = this.count;
    for (let i = 0; i < 4; i++) {
      const [x, y, z] = points[i];
      const [u, v] = uvs[i];
      this.vertex(x, y, z, normal[0], normal[1], normal[2], u, v, a, b);
    }
    this.triangle(base, base + 1, base + 2);
    this.triangle(base, base + 2, base + 3);
  }

  colors(hexA: string, hexB: string, shade = 1): [THREE.Color, THREE.Color] {
    this.tmpA.set(hexA).convertSRGBToLinear().multiplyScalar(shade);
    this.tmpB.set(hexB).convertSRGBToLinear().multiplyScalar(shade);
    return [this.tmpA.clone(), this.tmpB.clone()];
  }

  build(): THREE.BufferGeometry | null {
    if (!this.index.length) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.position, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(this.normal, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.colorA, 3));
    geometry.setAttribute("colorVi", new THREE.Float32BufferAttribute(this.colorB, 3));
    geometry.setIndex(this.index);
    geometry.computeBoundingSphere();
    return geometry;
  }
}

// ── Outils de polygone ──────────────────────────────────────────────────────

/** Test d'appartenance par lancer de rayon (règle pair-impair). */
function pointInRing(x: number, z: number, p: Ring): boolean {
  let inside = false;
  for (let i = 0, n = p.length / 2, j = n - 1; i < n; j = i++) {
    const xi = p[i * 2];
    const zi = p[i * 2 + 1];
    const xj = p[j * 2];
    const zj = p[j * 2 + 1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function ringCentroid(p: Ring): [number, number] {
  let x = 0;
  let z = 0;
  const n = p.length / 2;
  for (let i = 0; i < n; i++) {
    x += p[i * 2];
    z += p[i * 2 + 1];
  }
  return [x / n, z / n];
}

/**
 * Retire le point de fermeture et les doublons consécutifs.
 *
 * Une surface OSM est une *way* fermée : son dernier point répète le premier.
 * Donné tel quel à la triangulation, ce doublon produit un triangle dégénéré
 * qui fait échouer tout le découpage — les plans d'eau, les plages et les
 * pelouses disparaissaient en bloc, sans erreur.
 */
function openRing(p: Ring): Ring {
  const out: Ring = [];
  for (let i = 0; i < p.length; i += 2) {
    const n = out.length;
    if (n >= 2 && Math.abs(out[n - 2] - p[i]) < 1e-6 && Math.abs(out[n - 1] - p[i + 1]) < 1e-6) {
      continue;
    }
    out.push(p[i], p[i + 1]);
  }
  const n = out.length;
  if (
    n >= 6 &&
    Math.abs(out[0] - out[n - 2]) < 1e-6 &&
    Math.abs(out[1] - out[n - 1]) < 1e-6
  ) {
    out.length -= 2;
  }
  return out;
}

/**
 * Découpe un contour en triangles. `ShapeUtils.triangulateShape` attend des
 * `Vector2` : ici `y` porte le `z` du monde, la face étant horizontale.
 */
function triangulate(p: Ring): number[][] {
  const contour: THREE.Vector2[] = [];
  for (let i = 0; i < p.length; i += 2) contour.push(new THREE.Vector2(p[i], p[i + 1]));
  try {
    return THREE.ShapeUtils.triangulateShape(contour, []);
  } catch {
    return [];
  }
}

/** Surface horizontale (plage, pelouse, plan d'eau) posée à l'altitude `y`. */
function addFlatPolygon(
  builder: MeshBuilder,
  ring: Ring,
  y: number,
  hexA: string,
  hexB: string,
  uvScale: number,
) {
  const p = openRing(ring);
  if (p.length < 6) return;
  const faces = triangulate(p);
  if (!faces.length) return;
  const [a, b] = builder.colors(hexA, hexB);
  const base = builder.count;
  for (let i = 0; i < p.length; i += 2) {
    builder.vertex(p[i], y, p[i + 1], 0, 1, 0, p[i] / uvScale, p[i + 1] / uvScale, a, b);
  }
  for (const [i0, i1, i2] of faces) builder.triangle(base + i0, base + i2, base + i1);
}

// ── Immeubles ───────────────────────────────────────────────────────────────

export interface FacadeAnchor {
  slug: string;
  /** Milieu de la façade retenue. */
  x: number;
  y: number;
  z: number;
  /** Normale sortante de la façade (horizontale, normalisée). */
  nx: number;
  nz: number;
  /** Longueur de la façade (m) et hauteur de l'immeuble. */
  length: number;
  height: number;
}

export interface BuildingsResult {
  walls: THREE.BufferGeometry | null;
  roofs: THREE.BufferGeometry | null;
  /** Bandeau de néon au ras du sol — invisible en « vraie vie », allumé en VI. */
  neon: THREE.BufferGeometry | null;
  anchors: FacadeAnchor[];
}

export function buildBuildings(buildings: WorldBuilding[]): BuildingsResult {
  const walls = new MeshBuilder();
  const roofs = new MeshBuilder();
  const neon = new MeshBuilder();
  const anchors: FacadeAnchor[] = [];
  const random = rng(1312);

  for (const building of buildings) {
    const p = building.p;
    const n = p.length / 2;
    if (n < 3) continue;
    const height = building.h;
    const [cx, cz] = ringCentroid(p);

    // Teinte propre à l'immeuble : indice commun aux deux palettes, pour qu'un
    // immeuble blanc de South Beach devienne toujours le même rose VI.
    const tint = Math.floor(random() * REAL.facades.length);
    const shade = 0.88 + random() * 0.24;
    const [wallA, wallB] = walls.colors(REAL.facades[tint], VI.facades[tint], shade);
    const [roofA, roofB] = roofs.colors(REAL.roof, VI.roof, 0.9 + random() * 0.2);

    let longest = 0;
    let anchor: FacadeAnchor | null = null;
    let perimeter = 0;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x0 = p[i * 2];
      const z0 = p[i * 2 + 1];
      const x1 = p[j * 2];
      const z1 = p[j * 2 + 1];
      const dx = x1 - x0;
      const dz = z1 - z0;
      const length = Math.hypot(dx, dz);
      if (length < 0.2) continue;

      // Normale horizontale, retournée si elle regarde vers l'intérieur.
      let nx = dz / length;
      let nz = -dx / length;
      const mx = (x0 + x1) / 2;
      const mz = (z0 + z1) / 2;
      if (nx * (mx - cx) + nz * (mz - cz) < 0) {
        nx = -nx;
        nz = -nz;
      }

      const u0 = perimeter / MODULE;
      const u1 = (perimeter + length) / MODULE;
      const v1 = height / STOREY;
      perimeter += length;

      walls.quad(
        [
          [x0, 0, z0],
          [x1, 0, z1],
          [x1, height, z1],
          [x0, height, z0],
        ],
        [nx, 0, nz],
        [
          [u0, 0],
          [u1, 0],
          [u1, v1],
          [u0, v1],
        ],
        wallA,
        wallB,
      );

      // Bandeau lumineux de soubassement : la ligne de néon qui court le long
      // des façades de Vice City. En « vraie vie » sa couleur est celle du mur,
      // donc il disparaît.
      if (height > 5) {
        const [neonA, neonB] = neon.colors(REAL.facades[tint], VI.neon.color, 1);
        neon.quad(
          [
            [x0 + nx * 0.06, 0.5, z0 + nz * 0.06],
            [x1 + nx * 0.06, 0.5, z1 + nz * 0.06],
            [x1 + nx * 0.06, 0.78, z1 + nz * 0.06],
            [x0 + nx * 0.06, 0.78, z0 + nz * 0.06],
          ],
          [nx, 0, nz],
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
          neonA,
          neonB,
        );
      }

      // Acrotère : le liseré qui coiffe les toits et donne du relief aux
      // silhouettes vues d'en bas.
      if (height >= 6) {
        const ox = nx * 0.25;
        const oz = nz * 0.25;
        walls.quad(
          [
            [x0 + ox, height, z0 + oz],
            [x1 + ox, height, z1 + oz],
            [x1 + ox, height + 0.7, z1 + oz],
            [x0 + ox, height + 0.7, z0 + oz],
          ],
          [nx, 0, nz],
          [
            [u0, 0],
            [u1, 0],
            [u1, 0.2],
            [u0, 0.2],
          ],
          roofA,
          roofB,
        );
      }

      if (building.loc && length > longest) {
        longest = length;
        anchor = {
          slug: building.loc,
          x: mx,
          y: 0,
          z: mz,
          nx,
          nz,
          length,
          height,
        };
      }
    }

    if (anchor) anchors.push(anchor);

    // Toiture.
    const faces = triangulate(p);
    if (faces.length) {
      const base = roofs.count;
      for (let i = 0; i < n; i++) {
        roofs.vertex(
          p[i * 2],
          height,
          p[i * 2 + 1],
          0,
          1,
          0,
          p[i * 2] / 8,
          p[i * 2 + 1] / 8,
          roofA,
          roofB,
        );
      }
      for (const [i0, i1, i2] of faces) roofs.triangle(base + i0, base + i2, base + i1);
    }
  }

  return { walls: walls.build(), roofs: roofs.build(), neon: neon.build(), anchors };
}

// ── Voirie ──────────────────────────────────────────────────────────────────

export interface GroundResult {
  asphalt: THREE.BufferGeometry | null;
  pavement: THREE.BufferGeometry | null;
  markings: THREE.BufferGeometry | null;
  water: THREE.BufferGeometry | null;
  sand: THREE.BufferGeometry | null;
  green: THREE.BufferGeometry | null;
}

/**
 * Altitudes des couches au sol.
 *
 * L'étagement n'est pas cosmétique : deux surfaces coplanaires scintillent (le
 * *z-fighting*), et le trottoir doit de toute façon dominer la chaussée. Les
 * écarts sont volontairement décimétriques et non centimétriques — la mer
 * s'étend jusqu'à 2,5 km, et à cette distance le tampon de profondeur ne
 * distingue plus deux centimètres.
 *
 * La mer passe sous le plan de sol du moteur (−0,45 m), sans quoi celui-ci la
 * recouvrirait purement et simplement.
 */
const Y = {
  water: -0.25,
  sand: 0.03,
  green: 0.05,
  asphalt: 0.08,
  markings: 0.1,
  pavement: 0.17,
} as const;

/** Demi-largeur du trottoir, de part et d'autre de la chaussée. */
const PAVEMENT = 2.4;

/** Étalement de la mer au large du trait de côte (m) — au-delà, le brouillard. */
const SEA_WIDTH = 2500;

function addRibbon(
  builder: MeshBuilder,
  p: Ring,
  offset: number,
  width: number,
  y: number,
  a: THREE.Color,
  b: THREE.Color,
  uvScale: number,
) {
  const n = p.length / 2;
  let travelled = 0;
  for (let i = 0; i < n - 1; i++) {
    const x0 = p[i * 2];
    const z0 = p[i * 2 + 1];
    const x1 = p[(i + 1) * 2];
    const z1 = p[(i + 1) * 2 + 1];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const length = Math.hypot(dx, dz);
    if (length < 0.05) continue;
    // Perpendiculaire au segment.
    const px = dz / length;
    const pz = -dx / length;
    const c = offset;
    const h = width / 2;
    const v0 = travelled / uvScale;
    const v1 = (travelled + length) / uvScale;
    travelled += length;

    builder.quad(
      [
        [x0 + px * (c - h), y, z0 + pz * (c - h)],
        [x1 + px * (c - h), y, z1 + pz * (c - h)],
        [x1 + px * (c + h), y, z1 + pz * (c + h)],
        [x0 + px * (c + h), y, z0 + pz * (c + h)],
      ],
      [0, 1, 0],
      [
        [0, v0],
        [0, v1],
        [width / uvScale, v1],
        [width / uvScale, v0],
      ],
      a,
      b,
    );
  }
}

export function buildGround(world: StreetWorld): GroundResult {
  const asphalt = new MeshBuilder();
  const pavement = new MeshBuilder();
  const markings = new MeshBuilder();
  const water = new MeshBuilder();
  const sand = new MeshBuilder();
  const green = new MeshBuilder();

  const [roadA, roadB] = asphalt.colors(REAL.asphalt, VI.asphalt);
  const [kerbA, kerbB] = pavement.colors(REAL.sidewalk, VI.sidewalk);
  const [lineA, lineB] = markings.colors("#e8c84a", "#ffd166");

  for (const road of world.roads) {
    if (road.p.length < 4) continue;
    const walkable = road.k === "footway" || road.k === "path" || road.k === "steps";
    addRibbon(asphalt, road.p, 0, road.w, Y.asphalt, walkable ? kerbA : roadA, walkable ? kerbB : roadB, 6);
    if (!walkable && road.w >= 6) {
      // Trottoirs de part et d'autre, en deux rubans distincts : un seul ruban
      // plus large recouvrirait la chaussée.
      addRibbon(pavement, road.p, road.w / 2 + PAVEMENT / 2, PAVEMENT, Y.pavement, kerbA, kerbB, 2.4);
      addRibbon(pavement, road.p, -(road.w / 2 + PAVEMENT / 2), PAVEMENT, Y.pavement, kerbA, kerbB, 2.4);
    }
    if (road.w >= 11) addRibbon(markings, road.p, 0, 0.35, Y.markings, lineA, lineB, 1);
  }

  for (const ring of world.water) addFlatPolygon(water, ring, Y.water, REAL.water, VI.water, 24);

  // La mer, reconstituée à partir du trait de côte.
  //
  // OpenStreetMap ne stocke pas l'océan : il stocke sa limite, orientée pour
  // que la terre soit à gauche du sens de parcours. On étale donc une bande de
  // 2,5 km à droite de la ligne. En rubans plutôt qu'en un seul polygone :
  // une côte découpée, décalée d'une telle distance, se recouperait elle-même
  // et la triangulation rendrait n'importe quoi. Des quads qui se chevauchent
  // sur un plan horizontal, eux, ne se voient pas.
  //
  // Le côté « droit » dans notre repère : la direction du segment vaut
  // (dx, −dz) en (est, nord), donc la mer est en (−dz, dx) — soit l'opposé du
  // décalage positif d'`addRibbon`, d'où le signe négatif.
  const [seaA, seaB] = water.colors(REAL.water, VI.water);
  for (const line of world.coast) {
    addRibbon(water, line, -SEA_WIDTH / 2, SEA_WIDTH, Y.water, seaA, seaB, 24);
  }
  for (const ring of world.sand) addFlatPolygon(sand, ring, Y.sand, REAL.sand, VI.sand, 6);
  for (const ring of world.green) addFlatPolygon(green, ring, Y.green, REAL.green, VI.green, 8);

  return {
    asphalt: asphalt.build(),
    pavement: pavement.build(),
    markings: markings.build(),
    water: water.build(),
    sand: sand.build(),
    green: green.build(),
  };
}

// ── Palmiers ────────────────────────────────────────────────────────────────

/**
 * Un palmier = un tronc légèrement incliné et une couronne de palmes en
 * silhouette. Deux `InstancedMesh` suffisent pour les 1 400 arbres d'un
 * quartier — soit deux appels de rendu.
 */
export function buildPalms(
  trees: [number, number][],
  frondMaterial: THREE.Material,
  trunkMaterial: THREE.Material,
): { trunks: THREE.InstancedMesh; crowns: THREE.InstancedMesh } {
  const count = trees.length;
  const random = rng(555);

  const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.28, 1, 6, 1, true);
  trunkGeometry.translate(0, 0.5, 0); // pied à l'origine

  // Couronne : huit palmes en éventail, fusionnées en une seule géométrie.
  const frondPositions: number[] = [];
  const frondUvs: number[] = [];
  const frondNormals: number[] = [];
  const frondIndex: number[] = [];
  const FRONDS = 8;
  for (let i = 0; i < FRONDS; i++) {
    const angle = (i / FRONDS) * Math.PI * 2 + 0.3;
    const droop = -0.55 - (i % 2) * 0.22;
    const len = 2.5 + (i % 3) * 0.35;
    const wide = 0.85;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const base = frondPositions.length / 3;
    // Palme approchée par un quad incliné : de la base vers l'extérieur, en
    // retombant. Suffisant en silhouette, et c'est ainsi qu'on les lit de la rue.
    const points: [number, number, number][] = [
      [-dz * wide * 0.25, 0, dx * wide * 0.25],
      [dz * wide * 0.25, 0, -dx * wide * 0.25],
      [dx * len + dz * wide * 0.5, droop, dz * len - dx * wide * 0.5],
      [dx * len - dz * wide * 0.5, droop, dz * len + dx * wide * 0.5],
    ];
    const uvs: [number, number][] = [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
    ];
    for (let k = 0; k < 4; k++) {
      frondPositions.push(points[k][0], points[k][1], points[k][2]);
      frondUvs.push(uvs[k][0], uvs[k][1]);
      frondNormals.push(0, 1, 0);
    }
    frondIndex.push(base, base + 1, base + 2, base, base + 2, base + 3);
    frondIndex.push(base, base + 2, base + 1, base, base + 3, base + 2); // visible des deux côtés
  }
  const crownGeometry = new THREE.BufferGeometry();
  crownGeometry.setAttribute("position", new THREE.Float32BufferAttribute(frondPositions, 3));
  crownGeometry.setAttribute("normal", new THREE.Float32BufferAttribute(frondNormals, 3));
  crownGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(frondUvs, 2));
  crownGeometry.setIndex(frondIndex);
  crownGeometry.computeBoundingSphere();

  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, count);
  const crowns = new THREE.InstancedMesh(crownGeometry, frondMaterial, count);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  const euler = new THREE.Euler();

  for (let i = 0; i < count; i++) {
    const [x, z] = trees[i];
    const height = 6 + random() * 5;
    const lean = (random() - 0.5) * 0.22;
    const spin = random() * Math.PI * 2;

    euler.set(lean, spin, lean * 0.6);
    quaternion.setFromEuler(euler);

    position.set(x, 0, z);
    scale.set(1, height, 1);
    matrix.compose(position, quaternion, scale);
    trunks.setMatrixAt(i, matrix);

    position.set(x + Math.sin(lean) * height, height, z + Math.sin(lean * 0.6) * height);
    scale.setScalar(0.9 + random() * 0.45);
    matrix.compose(position, quaternion, scale);
    crowns.setMatrixAt(i, matrix);
  }
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  trunks.frustumCulled = false;
  crowns.frustumCulled = false;
  return { trunks, crowns };
}

// ── Collisions ──────────────────────────────────────────────────────────────

/**
 * Grille régulière des arêtes de façade.
 *
 * Le joueur ne traverse pas les murs : à chaque pas on ne teste que les arêtes
 * des cases voisines, soit une poignée de segments au lieu des ~30 000 du
 * quartier.
 */
export class CollisionGrid {
  private readonly cell: number;
  /** Arêtes indexées par case. */
  private readonly edgeCells = new Map<number, number[]>();
  /** Emprises indexées par case, pour le test d'appartenance. */
  private readonly ringCells = new Map<number, number[]>();
  /** Arêtes à plat : `[x0, z0, x1, z1, …]`. */
  private readonly edges: number[] = [];
  private readonly rings: Ring[] = [];

  constructor(buildings: WorldBuilding[], cell = 24) {
    this.cell = cell;
    for (const building of buildings) {
      const p = building.p;
      const n = p.length / 2;
      if (n < 3) continue;
      const ringIndex = this.rings.length;
      this.rings.push(p);

      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const index = this.edges.length / 4;
        this.edges.push(p[i * 2], p[i * 2 + 1], p[j * 2], p[j * 2 + 1]);
        this.spread(this.edgeCells, index, p[i * 2], p[i * 2 + 1], p[j * 2], p[j * 2 + 1]);
        minX = Math.min(minX, p[i * 2]);
        maxX = Math.max(maxX, p[i * 2]);
        minZ = Math.min(minZ, p[i * 2 + 1]);
        maxZ = Math.max(maxZ, p[i * 2 + 1]);
      }
      this.spread(this.ringCells, ringIndex, minX, minZ, maxX, maxZ);
    }
  }

  private key(cx: number, cz: number): number {
    // 16 bits par axe : largement de quoi couvrir un quartier de 4 km.
    return ((cx + 32768) << 16) | (cz + 32768);
  }

  private spread(
    map: Map<number, number[]>,
    index: number,
    x0: number,
    z0: number,
    x1: number,
    z1: number,
  ) {
    const minX = Math.floor(Math.min(x0, x1) / this.cell);
    const maxX = Math.floor(Math.max(x0, x1) / this.cell);
    const minZ = Math.floor(Math.min(z0, z1) / this.cell);
    const maxZ = Math.floor(Math.max(z0, z1) / this.cell);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const key = this.key(cx, cz);
        const bucket = map.get(key);
        if (bucket) bucket.push(index);
        else map.set(key, [index]);
      }
    }
  }

  /** Point le plus proche du contour `ring`, et sa distance. */
  private closestOnRing(ring: Ring, px: number, pz: number) {
    let bestX = px;
    let bestZ = pz;
    let best = Infinity;
    const n = ring.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = ring[i * 2];
      const az = ring[i * 2 + 1];
      const dx = ring[j * 2] - ax;
      const dz = ring[j * 2 + 1] - az;
      const lengthSq = dx * dx + dz * dz;
      if (lengthSq < 1e-9) continue;
      let t = ((px - ax) * dx + (pz - az) * dz) / lengthSq;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = ax + dx * t;
      const qz = az + dz * t;
      const distance = Math.hypot(px - qx, pz - qz);
      if (distance < best) {
        best = distance;
        bestX = qx;
        bestZ = qz;
      }
    }
    return { x: bestX, z: bestZ, distance: best };
  }

  /**
   * Ramène un point hors des immeubles.
   *
   * Deux corrections successives, et les deux sont nécessaires. Tenir le joueur
   * à distance des murs suffit tant qu'il reste dehors — mais si un coin
   * l'y pousse, ou s'il arrive déjà à l'intérieur (téléportation vers une
   * fiche), plus aucune arête ne le concerne et il marche dans les murs. On
   * teste donc d'abord l'appartenance à une emprise, pour le ressortir par la
   * façade la plus proche, puis on écarte des murs comme d'habitude.
   */
  resolve(x: number, z: number, radius: number): [number, number] {
    let px = x;
    let pz = z;

    // 1. Sorti de force si l'on est à l'intérieur d'une emprise.
    for (let pass = 0; pass < 2; pass++) {
      const cx = Math.floor(px / this.cell);
      const cz = Math.floor(pz / this.cell);
      const bucket = this.ringCells.get(this.key(cx, cz));
      if (!bucket) break;
      let inside: Ring | null = null;
      for (const index of bucket) {
        if (pointInRing(px, pz, this.rings[index])) {
          inside = this.rings[index];
          break;
        }
      }
      if (!inside) break;
      const near = this.closestOnRing(inside, px, pz);
      if (near.distance < 1e-4) {
        // Pile sur la façade : on s'écarte le long de la normale de l'arête.
        px += radius;
        continue;
      }
      // Le vecteur façade → point regarde vers l'intérieur : on ressort de
      // l'autre côté du mur, à un rayon de distance.
      const ux = (px - near.x) / near.distance;
      const uz = (pz - near.z) / near.distance;
      px = near.x - ux * radius;
      pz = near.z - uz * radius;
    }

    // 2. Écartement des murs proches — un coin de rue en met deux en jeu, et
    // corriger le premier peut faire pénétrer le second.
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      const cx = Math.floor(px / this.cell);
      const cz = Math.floor(pz / this.cell);
      for (let ix = cx - 1; ix <= cx + 1; ix++) {
        for (let iz = cz - 1; iz <= cz + 1; iz++) {
          const bucket = this.edgeCells.get(this.key(ix, iz));
          if (!bucket) continue;
          for (const index of bucket) {
            const ax = this.edges[index * 4];
            const az = this.edges[index * 4 + 1];
            const bx = this.edges[index * 4 + 2];
            const bz = this.edges[index * 4 + 3];
            const dx = bx - ax;
            const dz = bz - az;
            const lengthSq = dx * dx + dz * dz;
            if (lengthSq < 1e-6) continue;
            let t = ((px - ax) * dx + (pz - az) * dz) / lengthSq;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const qx = ax + dx * t;
            const qz = az + dz * t;
            const ox = px - qx;
            const oz = pz - qz;
            const distance = Math.hypot(ox, oz);
            if (distance >= radius) continue;
            if (distance < 1e-4) {
              px += radius;
              moved = true;
              continue;
            }
            const push = (radius - distance) / distance;
            px += ox * push;
            pz += oz * push;
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
    return [px, pz];
  }
}

// ── Correspondance avec la carte du jeu ─────────────────────────────────────

/**
 * Ajuste la similitude qui envoie le quartier réel sur les coordonnées du jeu.
 *
 * Modèle : `gx = a·X − b·Y + tx`, `gy = b·X + a·Y + ty`, avec `X = x` (est) et
 * `Y = −z` (nord). Passer par le nord plutôt que par le sud n'est pas cosmétique :
 * la carte du jeu compte ses `y` vers le nord, et un repère qui les compte vers
 * le sud est de chiralité opposée — aucune rotation ne les superpose, il faudrait
 * une symétrie. En retournant l'axe d'abord, une simple similitude suffit.
 *
 * Quatre inconnues, résolues au sens des moindres carrés sur tous les lieux du
 * quartier ; la solution est directe, sans itération.
 *
 * Ce n'est valable qu'ici, à l'échelle d'un quartier. Rockstar a resserré
 * Leonida : à l'échelle de la carte entière, aucune similitude ne tient
 * (563 km entre Panama City et Miami dans la réalité, une dizaine dans le jeu).
 */
export function fitGameTransform(spots: WorldSpot[]): GameTransform | null {
  const n = spots.length;
  if (n < 3) return null;

  let sx = 0;
  let sy = 0;
  let sgx = 0;
  let sgy = 0;
  for (const s of spots) {
    sx += s.x;
    sy += -s.z;
    sgx += s.gx;
    sgy += s.gy;
  }
  const mx = sx / n;
  const my = sy / n;
  const mgx = sgx / n;
  const mgy = sgy / n;

  let num1 = 0; // Σ (X·gx + Y·gy)
  let num2 = 0; // Σ (X·gy − Y·gx)
  let den = 0; // Σ (X² + Y²)
  for (const s of spots) {
    const x = s.x - mx;
    const y = -s.z - my;
    const gx = s.gx - mgx;
    const gy = s.gy - mgy;
    num1 += x * gx + y * gy;
    num2 += x * gy - y * gx;
    den += x * x + y * y;
  }
  if (den < 1e-6) return null;

  const a = num1 / den;
  const b = num2 / den;
  const tx = mgx - (a * mx - b * my);
  const ty = mgy - (b * mx + a * my);
  const transform: GameTransform = {
    a,
    b,
    tx,
    ty,
    scale: Math.hypot(a, b),
    rotation: (Math.atan2(b, a) * 180) / Math.PI,
    error: 0,
    samples: n,
  };

  const errors = spots
    .map((s) => {
      const [gx, gy] = applyGameTransform(transform, s.x, s.z);
      return Math.hypot(gx - s.gx, gy - s.gy);
    })
    .sort((p, q) => p - q);
  transform.error = Math.round(errors[Math.floor(errors.length / 2)]);
  return transform;
}

/** Position dans le jeu (mètres monde) d'un point du quartier réel. */
export function applyGameTransform(
  t: GameTransform,
  x: number,
  z: number,
): [number, number] {
  const y = -z;
  return [t.a * x - t.b * y + t.tx, t.b * x + t.a * y + t.ty];
}
