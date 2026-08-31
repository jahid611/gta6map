/**
 * Monde du mode piéton (`/street`), tel que produit par `scripts/build-world.ts`.
 *
 * Toutes les coordonnées sont en mètres dans un repère local au quartier :
 * `x` vers l'est, `z` vers le sud. Le nord est donc `-z`, ce qui correspond à
 * l'orientation par défaut d'une caméra three.js.
 *
 * Les contours sont des tableaux plats `[x0, z0, x1, z1, …]` : deux fois moins
 * d'objets à parser qu'une liste de points, sur des fichiers de 600 Ko.
 */

/** Contour ou polyligne : `[x0, z0, x1, z1, …]`. */
export type Ring = number[];

export interface WorldBuilding {
  p: Ring;
  /** Hauteur au faîtage (m). */
  h: number;
  /** Valeur OSM du tag `building` (`apartments`, `hotel`, `yes`…). */
  k: string;
  n?: string;
  /** Slug de la fiche du site dont la photo habille la façade. */
  loc?: string;
}

export interface WorldRoad {
  p: Ring;
  /** Largeur de chaussée (m), trottoirs non compris. */
  w: number;
  k: string;
  n?: string;
}

/**
 * Un lieu du site présent dans le quartier : il porte à la fois ses coordonnées
 * réelles (projetées ici) et ses coordonnées dans le jeu, ce qui permet de
 * passer de l'un à l'autre sans quitter la rue.
 */
export interface WorldSpot {
  slug: string;
  name: string;
  x: number;
  z: number;
  /** Capture in-game (fichier à résoudre par `photoUrl()`). */
  ig?: string;
  /** Photo du lieu réel. */
  irl?: string;
  cat: string;
  color?: string;
  area?: string;
  /** Coordonnées monde dans le jeu (mètres RAGE). */
  gx: number;
  gy: number;
  address?: string;
}

export interface StreetWorld {
  id: string;
  name: string;
  /** Zones du jeu couvertes par le quartier. */
  areas: string[];
  /** [lat, lng] du point (0, 0) local. */
  origin: [number, number];
  /** [sud, ouest, nord, est] */
  bbox: [number, number, number, number];
  spawn: { x: number; z: number; heading: number };
  buildings: WorldBuilding[];
  roads: WorldRoad[];
  water: Ring[];
  /**
   * Trait de côte, en polylignes ouvertes. OpenStreetMap ne cartographie pas la
   * mer — seulement sa limite, orientée de sorte que la terre soit à gauche.
   * La mer est donc reconstituée à droite de la ligne.
   */
  coast: Ring[];
  sand: Ring[];
  green: Ring[];
  trees: [number, number][];
  spots: WorldSpot[];
  generatedAt: string;
  attribution: string;
}

export interface StreetZoneSummary {
  id: string;
  name: string;
  buildings: number;
  spots: number;
}

/**
 * Similitude qui envoie le repère local (mètres réels) sur les coordonnées du
 * jeu : `gx = a·x − b·z + tx`, `gy = b·x + a·z + ty`.
 *
 * Ajustée par moindres carrés sur les lieux du quartier — voir
 * `fitGameTransform`. À l'échelle d'un quartier la correspondance est bonne ;
 * à l'échelle de Leonida elle ne l'est pas, la géographie du jeu étant un
 * collage (Port Gellhorn est à 563 km de Miami dans la réalité).
 */
export interface GameTransform {
  a: number;
  b: number;
  tx: number;
  ty: number;
  /** Facteur d'échelle mètres-jeu par mètre réel. */
  scale: number;
  /** Rotation appliquée (degrés). */
  rotation: number;
  /** Erreur médiane de la correspondance (m). */
  error: number;
  /** Nombre de lieux ayant servi à l'ajustement. */
  samples: number;
}

/** Les deux ambiances du mode piéton. */
export type StreetMode = "real" | "vi";
