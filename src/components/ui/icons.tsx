import { createElement } from "react";
import { ICON_PATHS, type IconName } from "./icons.generated";

export type { IconName };

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

/**
 * Icônes Flaticon UIcons (Solid Straight), exposées avec la même signature que
 * les composants Lucide qu'elles remplacent : `<MapPin className="h-4 w-4" />`.
 *
 * Les contours sont extraits de la fonte du jeu par `npm run build:icons` (voir
 * `scripts/build-icons.ts` pour le pourquoi) : on obtient de vrais SVG, donc
 * dimensionnés par leur boîte et colorés par `currentColor`, sans embarquer les
 * 252 Ko de la fonte-icône complète.
 *
 * Ce sont des glyphes pleins : ils s'écrivent en `fill`, pas en `stroke`.
 * Attribution Flaticon : voir le pied de page du site.
 */
function makeIcon(name: IconName) {
  const d = ICON_PATHS[name];
  const Component = ({ className, ...props }: IconProps) => (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path d={d} />
    </svg>
  );
  Component.displayName = name;
  return Component;
}

export const ArrowLeft = makeIcon("ArrowLeft");
export const ArrowRight = makeIcon("ArrowRight");
export const ArrowUpRight = makeIcon("ArrowUpRight");
export const BookOpen = makeIcon("BookOpen");
export const Camera = makeIcon("Camera");
export const Check = makeIcon("Check");
export const CheckCircle2 = makeIcon("CheckCircle2");
export const ChevronDown = makeIcon("ChevronDown");
export const ChevronLeft = makeIcon("ChevronLeft");
export const ChevronRight = makeIcon("ChevronRight");
export const Cloud = makeIcon("Cloud");
export const CloudOff = makeIcon("CloudOff");
export const Compass = makeIcon("Compass");
export const CornerDownLeft = makeIcon("CornerDownLeft");
export const Crosshair = makeIcon("Crosshair");
export const ExternalLink = makeIcon("ExternalLink");
export const Eye = makeIcon("Eye");
export const EyeOff = makeIcon("EyeOff");
export const Grid3x3 = makeIcon("Grid3x3");
export const Layers = makeIcon("Layers");
export const Loader2 = makeIcon("Loader2");
export const LogIn = makeIcon("LogIn");
export const LogOut = makeIcon("LogOut");
export const Mail = makeIcon("Mail");
export const MapPin = makeIcon("MapPin");
export const Minus = makeIcon("Minus");
export const PanelLeft = makeIcon("PanelLeft");
export const Pin = makeIcon("Pin");
export const Plus = makeIcon("Plus");
export const RotateCcw = makeIcon("RotateCcw");
export const Search = makeIcon("Search");
export const SlidersHorizontal = makeIcon("SlidersHorizontal");
export const Trophy = makeIcon("Trophy");
export const Type = makeIcon("Type");
export const X = makeIcon("X");

/** Icônes de catégories — résolues par nom depuis le champ `icon` des catégories. */
export const CATEGORY_ICONS: Readonly<Partial<Record<IconName, ReturnType<typeof makeIcon>>>> = {
  Building2: makeIcon("Building2"),
  Camera,
  Car: makeIcon("Car"),
  Clapperboard: makeIcon("Clapperboard"),
  Crosshair,
  Egg: makeIcon("Egg"),
  Factory: makeIcon("Factory"),
  Film: makeIcon("Film"),
  Flag: makeIcon("Flag"),
  Fuel: makeIcon("Fuel"),
  Gem: makeIcon("Gem"),
  Home: makeIcon("Home"),
  Hotel: makeIcon("Hotel"),
  Landmark: makeIcon("Landmark"),
  MapPin,
  Mountain: makeIcon("Mountain"),
  Palmtree: makeIcon("Palmtree"),
  PartyPopper: makeIcon("PartyPopper"),
  Pin,
  Plane: makeIcon("Plane"),
  RadioTower: makeIcon("RadioTower"),
  Road: makeIcon("Road"),
  Star: makeIcon("Star"),
  Store: makeIcon("Store"),
  TreePine: makeIcon("TreePine"),
  Utensils: makeIcon("Utensils"),
};

/** Composant d'icône d'une catégorie, avec repli sur le marqueur générique. */
export function categoryIcon(name: string) {
  return CATEGORY_ICONS[name as IconName] ?? MapPin;
}

/**
 * Icône d'une catégorie, résolue par nom.
 *
 * À préférer à `categoryIcon()` dans du JSX : affecter le résultat à une
 * variable capitalisée revient, du point de vue de React, à fabriquer un
 * composant pendant le rendu — ce que la règle de lint interdit à juste titre,
 * puisqu'un composant recréé à chaque rendu est remonté à chaque rendu. Ici la
 * résolution reste interne et le JSX appelant ne manipule qu'un élément.
 */
export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  // `createElement` plutôt qu'une variable capitalisée : les icônes viennent
  // d'une table construite une fois pour toutes, leur identité est donc stable
  // et rien n'est fabriqué pendant le rendu — mais la forme `const Glyph = …`
  // est indiscernable, pour l'analyseur, d'une vraie fabrique de composants.
  return createElement(categoryIcon(name), { className });
}

export const Copy = makeIcon("Copy");
export const Database = makeIcon("Database");
export const Link2 = makeIcon("Link2");
export const LocateFixed = makeIcon("LocateFixed");
export const Maximize2 = makeIcon("Maximize2");
export const Download = makeIcon("Download");
export const Mountain = makeIcon("Mountain");
export const Ruler = makeIcon("Ruler");
