/**
 * Conversion des couleurs de catégories en teintes pastel.
 *
 * Les couleurs du jeu de données sont vives et saturées (`#e50914`, `#3b82f6`…).
 * Sur une carte qui affiche plus de mille points, cette saturation crie et fait
 * « jouet ». On garde donc la teinte — c'est elle qui identifie la catégorie —
 * mais on plafonne la saturation et on remonte la clarté.
 *
 * Conséquence à ne pas perdre de vue : un aplat pastel est clair, donc le glyphe
 * posé dessus doit être sombre. C'est ce que fait `.gta-marker__pin` en CSS.
 */

/** `#rrggbb` → `[h, s, l]` avec h en degrés, s et l en 0–1. */
function hexToHsl(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

/**
 * Variante pastel d'une couleur.
 *
 * @param hex     couleur d'origine
 * @param light   clarté cible (0–1)
 * @param satCap  saturation maximale conservée
 */
export function pastel(hex: string, light = 0.76, satCap = 0.62): string {
  if (!/^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) return hex;
  const [h, s, l] = hexToHsl(hex);
  // Une couleur déjà désaturée (un gris) ne doit pas être teintée artificiellement.
  const sat = Math.min(s, satCap) * (s < 0.08 ? 0 : 1);
  // On conserve un peu de la clarté d'origine : sans cela, un jaune et un bleu
  // marine finiraient rigoureusement au même niveau et se confondraient.
  const lum = light + (l - 0.5) * 0.12;
  return `hsl(${h.toFixed(1)} ${(sat * 100).toFixed(0)}% ${(lum * 100).toFixed(0)}%)`;
}

/** Variante pastel plus soutenue, pour un texte sur fond sombre. */
export function pastelInk(hex: string): string {
  return pastel(hex, 0.7, 0.7);
}
