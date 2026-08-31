import type { StreetMode } from "@/types/street";

/**
 * Les deux peaux du mode piéton.
 *
 * La géométrie ne change jamais d'une ambiance à l'autre : c'est le même
 * trottoir, le même immeuble, la même plage. Seules changent la lumière, les
 * couleurs et les photos plaquées sur les façades. C'est tout l'intérêt de la
 * bascule — on reste exactement au même endroit, et on voit ce que Rockstar en
 * a fait.
 *
 * « Réel » : Miami en début d'après-midi, ciel de Floride, façades Art déco
 * pastel de South Beach.
 *
 * « VI » : la direction artistique du site (`globals.css`) portée en volume —
 * coucher de soleil rose/orange, néons, ombres longues.
 */
export interface Ambiance {
  key: StreetMode;
  label: string;
  hint: string;
  /** Dégradé de ciel, du zénith à l'horizon. */
  sky: [string, string, string];
  fog: { color: string; near: number; far: number };
  /** Soleil directionnel : couleur, intensité, azimut (deg, 0 = nord) et hauteur (deg). */
  sun: { color: string; intensity: number; azimuth: number; elevation: number };
  ambient: { sky: string; ground: string; intensity: number };
  /** Couleurs des surfaces. */
  asphalt: string;
  sidewalk: string;
  ground: string;
  water: string;
  sand: string;
  green: string;
  /** Teintes de façade tirées au sort par bâtiment (indice stable entre ambiances). */
  facades: string[];
  roof: string;
  /** Couleur d'émission des fenêtres, et son intensité. */
  windows: { color: string; intensity: number };
  /** Néon de soubassement des immeubles — la signature de Vice City. */
  neon: { color: string; intensity: number };
  trunk: string;
  foliage: string;
  /** Exposition du rendu. */
  exposure: number;
  /** Voile de couleur et grain appliqués en CSS par-dessus le canvas. */
  grade: { tint: string; tintOpacity: number; grain: number; vignette: number };
}

/**
 * Façades de South Beach : blanc cassé, pêche, menthe, sable — la palette Art
 * déco réelle, relevée sur Ocean Drive et Collins Ave.
 */
const FACADES_REAL = [
  "#efe8dd",
  "#e6dccd",
  "#f2ded0",
  "#dfe7e2",
  "#e8e2d2",
  "#d9d3c6",
  "#f0e6da",
  "#dde3e6",
  "#e4d8c8",
  "#eae4dc",
];

/** Les mêmes façades passées au coucher de soleil VI : magenta, indigo, ambre. */
const FACADES_VI = [
  "#f2b9cf",
  "#c98fb4",
  "#f7a98a",
  "#8ea6cf",
  "#e0a0a8",
  "#9a7ab0",
  "#ffc9a6",
  "#7f93c4",
  "#d98fa0",
  "#efd0c4",
];

export const AMBIANCES: Record<StreetMode, Ambiance> = {
  real: {
    key: "real",
    label: "Vraie vie",
    hint: "Miami, aujourd'hui",
    sky: ["#2f7fd0", "#7cb8e8", "#d8ecf7"],
    fog: { color: "#cfe4f2", near: 90, far: 1100 },
    sun: { color: "#fff6e6", intensity: 2.6, azimuth: 205, elevation: 62 },
    ambient: { sky: "#bcd9ef", ground: "#8b8377", intensity: 1.35 },
    asphalt: "#4a4a4d",
    sidewalk: "#b9b3a6",
    ground: "#8f9a86",
    water: "#2f8fb0",
    sand: "#e2d3ad",
    green: "#6f9155",
    facades: FACADES_REAL,
    roof: "#8d8a80",
    windows: { color: "#0d1620", intensity: 0 },
    neon: { color: "#000000", intensity: 0 },
    trunk: "#7a6249",
    foliage: "#4f7a3f",
    exposure: 1.05,
    grade: { tint: "#fff2d8", tintOpacity: 0.05, grain: 0.03, vignette: 0.22 },
  },
  vi: {
    key: "vi",
    label: "GTA VI",
    hint: "Vice City, crépuscule",
    sky: ["#3b4cc0", "#a24dbd", "#ffb347"],
    fog: { color: "#e6779e", near: 60, far: 900 },
    sun: { color: "#ffb26b", intensity: 2.2, azimuth: 258, elevation: 7 },
    ambient: { sky: "#f050a0", ground: "#2f2e52", intensity: 1.5 },
    asphalt: "#2b2436",
    sidewalk: "#6b5f77",
    ground: "#3a3350",
    water: "#20408f",
    sand: "#c9a37f",
    green: "#3f6b52",
    facades: FACADES_VI,
    roof: "#4b4166",
    windows: { color: "#ffd9a0", intensity: 1.4 },
    neon: { color: "#f976b0", intensity: 1 },
    trunk: "#4a3a45",
    foliage: "#2f5c4a",
    exposure: 1.16,
    grade: { tint: "#ff7ab0", tintOpacity: 0.12, grain: 0.07, vignette: 0.38 },
  },
};

export const REAL = AMBIANCES.real;
export const VI = AMBIANCES.vi;
