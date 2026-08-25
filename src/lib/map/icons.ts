import { ICON_PATHS, type IconName } from "@/components/ui/icons.generated";
import { pastel } from "@/lib/colors";

/**
 * Les marqueurs Leaflet sont produits en HTML (`L.divIcon`), pas en React : on y
 * injecte donc le SVG sous forme de chaîne, à partir des mêmes contours Flaticon
 * UIcons que le reste du site (voir `scripts/build-icons.ts`). Les clés du
 * registre correspondent au champ `icon` des catégories.
 */
const svgCache = new Map<string, string>();

function escapeAttr(value: string | number): string {
  return String(value).replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * SVG inline (chaîne) d'une icône, mémoïsé par nom + taille.
 *
 * Glyphes pleins : ils se peignent en `fill`, sans `stroke` — c'est ce qui donne
 * aux blips leur aspect compact plutôt que le trait fin d'une icône linéaire.
 */
export function iconSvg(name: string, size = 14): string {
  const key = `${name}:${size}`;
  const cached = svgCache.get(key);
  if (cached) return cached;
  const d = ICON_PATHS[name as IconName] ?? ICON_PATHS.MapPin;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${escapeAttr(d)}"/></svg>`;
  svgCache.set(key, svg);
  return svg;
}

export interface MarkerIconOptions {
  color: string;
  icon: string;
  found?: boolean;
  selected?: boolean;
  /** Marqueur caméra (trailer / screenshot) : badge avec libellé et cône de vue. */
  camera?: { label: string; yaw: number } | null;
}

/** Taille du marqueur (px) — utilisée pour `iconSize` / `iconAnchor`.
 *  Doit rester synchronisée avec `.gta-marker` dans globals.css. */
export const MARKER_SIZE = 22;
export const CAMERA_MARKER_SIZE = 30;

/**
 * HTML d'un marqueur : pastille colorée + icône de catégorie.
 * Les états `found` / `selected` sont pilotés par des classes CSS (voir globals.css).
 */
export function markerHtml({ color, icon, found = false, selected = false, camera = null }: MarkerIconOptions): string {
  const classes = ["gta-marker", camera && "gta-marker--camera", found && "is-found", selected && "is-selected"]
    .filter(Boolean)
    .join(" ");
  const cone = camera
    ? `<span class="gta-marker__cone" style="--yaw:${escapeAttr(camera.yaw.toFixed(1))}deg"></span>`
    : "";
  const label = camera ? `<span class="gta-marker__label">${escapeAttr(camera.label)}</span>` : "";
  // Teinte pastel : cf. `lib/colors`. Le glyphe posé dessus est sombre (CSS).
  return `<div class="${classes}" style="--marker-color:${escapeAttr(pastel(color))}">
    ${cone}
    <span class="gta-marker__pin">${iconSvg(icon, camera ? 14 : 12)}</span>
    <span class="gta-marker__check">${iconSvg("Check", 9)}</span>
    ${label}
  </div>`;
}

export function clusterHtml(count: number, dominantColor: string): string {
  const size = count < 10 ? "sm" : count < 50 ? "md" : "lg";
  return `<div class="gta-cluster gta-cluster--${size}" style="--marker-color:${escapeAttr(pastel(dominantColor))}"><span>${count}</span></div>`;
}

/** Étiquette de zone (grand texte blanc contour sombre, façon carte officielle). */
export function areaLabelHtml(name: string, level: 1 | 2 = 1): string {
  return `<div class="gta-area-label gta-area-label--${level}"><span>${escapeAttr(name)}</span></div>`;
}

export function isRegisteredIcon(name: string): boolean {
  return name in ICON_PATHS;
}
