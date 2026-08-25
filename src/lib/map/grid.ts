import { GRID_BOUNDS, GRID_CELL_METERS, GRID_ORIGIN } from "./config";

/**
 * Repère d'une cellule du quadrillage : lettre(s) pour la colonne, nombre pour
 * la ligne (« A1 », « E3 », « G8 »). Au-delà de Z on enchaîne sur AA, AB… comme
 * un tableur, mais la carte couverte tient largement dans une seule lettre.
 *
 * Retourne `null` hors de `GRID_BOUNDS` : inutile d'étiqueter la marge de
 * navigation ni la bande ouest recouverte d'océan.
 */
export function gridRef(col: number, row: number): string | null {
  if (col < 0 || row < 0) return null;
  const [[xMin, yMin], [xMax, yMax]] = GRID_BOUNDS;
  const [ox, oy] = GRID_ORIGIN;

  const cellXMin = ox + col * GRID_CELL_METERS;
  const cellYMax = oy - row * GRID_CELL_METERS;
  if (cellXMin < xMin || cellXMin >= xMax) return null;
  if (cellYMax > yMax || cellYMax <= yMin) return null;

  let letters = "";
  for (let n = col; ; n = Math.floor(n / 26) - 1) {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    if (n < 26) break;
  }
  return `${letters}${row + 1}`;
}
