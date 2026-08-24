/** État de complétion d'un lieu pour l'utilisateur courant. */
export interface ProgressEntry {
  locationId: string;
  found: boolean;
  /** ISO 8601 — sert à résoudre les conflits lors de la synchro (dernier écrit gagne). */
  updatedAt: string;
  note: string | null;
}

export interface ProgressSummary {
  total: number;
  found: number;
  /** 0..100 */
  percent: number;
}

export type ProgressByCategory = Record<string, ProgressSummary>;

/** Marqueur personnalisé créé par l'utilisateur. */
export interface CustomMarker {
  id: string;
  name: string;
  description: string | null;
  x: number;
  y: number;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}
