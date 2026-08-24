import type { IconNode } from "lucide";
import {
  Building2,
  Camera,
  Car,
  Check,
  Clapperboard,
  Crosshair,
  Egg,
  Factory,
  Film,
  Flag,
  Fuel,
  Gem,
  Home,
  Hotel,
  Landmark,
  MapPin,
  Mountain,
  Palmtree,
  PartyPopper,
  Pin,
  Plane,
  RadioTower,
  Star,
  Store,
  TreePine,
  Utensils,
} from "lucide";

/**
 * Registre d'icônes Lucide (package vanilla `lucide`, pas de React) utilisé pour
 * générer le HTML des `L.divIcon`. Les noms correspondent au champ `icon` des
 * catégories (PascalCase, identique à lucide-react).
 */
const ICON_REGISTRY: Readonly<Record<string, IconNode>> = {
  Building2,
  Camera,
  Car,
  Check,
  Clapperboard,
  Crosshair,
  Egg,
  Factory,
  Film,
  Flag,
  Fuel,
  Gem,
  Home,
  Hotel,
  Landmark,
  MapPin,
  Mountain,
  Palmtree,
  PartyPopper,
  Pin,
  Plane,
  RadioTower,
  Star,
  Store,
  TreePine,
  Utensils,
};

const svgCache = new Map<string, string>();

function escapeAttr(value: string | number): string {
  return String(value).replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** SVG inline (string) d'une icône Lucide, mémoïsé par nom+taille. */
export function iconSvg(name: string, size = 14, strokeWidth = 2.25): string {
  const key = `${name}:${size}:${strokeWidth}`;
  const cached = svgCache.get(key);
  if (cached) return cached;
  const node = ICON_REGISTRY[name] ?? MapPin;
  const children = node
    .map(([tag, attrs]) => {
      const attrString = Object.entries(attrs)
        .map(([k, v]) => `${k}="${escapeAttr(v as string | number)}"`)
        .join(" ");
      return `<${tag} ${attrString}/>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${children}</svg>`;
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

/** Taille du marqueur (px) — utilisée pour `iconSize` / `iconAnchor`. */
export const MARKER_SIZE = 28;
export const CAMERA_MARKER_SIZE = 34;

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
  return `<div class="${classes}" style="--marker-color:${escapeAttr(color)}">
    ${cone}
    <span class="gta-marker__pin">${iconSvg(icon, camera ? 15 : 14)}</span>
    <span class="gta-marker__check">${iconSvg("Check", 10, 3)}</span>
    ${label}
  </div>`;
}

export function clusterHtml(count: number, dominantColor: string): string {
  const size = count < 10 ? "sm" : count < 50 ? "md" : "lg";
  return `<div class="gta-cluster gta-cluster--${size}" style="--marker-color:${escapeAttr(dominantColor)}"><span>${count}</span></div>`;
}

/** Étiquette de zone (grand texte blanc contour sombre, façon carte officielle). */
export function areaLabelHtml(name: string, level: 1 | 2 = 1): string {
  return `<div class="gta-area-label gta-area-label--${level}"><span>${escapeAttr(name)}</span></div>`;
}

export function isRegisteredIcon(name: string): boolean {
  return name in ICON_REGISTRY;
}
