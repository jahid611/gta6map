import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TileSetId, WorldXY } from "@/types/map";
import { DEFAULT_TILE_SET, DEFAULT_VIEW, TILE_SETS } from "@/lib/map/config";
import { DEFAULT_MAP_FILTER, MAP_FILTERS } from "@/lib/map/filters";

/** Demande de déplacement caméra consommée par `MapController` (one-shot). */
export interface FlyToRequest {
  center: WorldXY;
  zoom?: number;
  /** Compteur pour forcer la ré-exécution même si la cible est identique. */
  nonce: number;
}

interface MapState {
  center: WorldXY;
  zoom: number;
  tileSet: TileSetId;
  showAreaLabels: boolean;
  /** Quadrillage de repérage (A1, E3, G8…). Éteint par défaut : c'est un outil
   *  de coordination, pas un élément de lecture courante de la carte. */
  showGrid: boolean;
  /** Filtre visuel appliqué aux tuiles (cf. `lib/map/filters`). */
  mapFilter: string;
  /** Unité des distances mesurées. */
  unit: "km" | "mi";
  /** Règle active : chaque clic sur la carte pose un point de mesure. */
  measuring: boolean;
  /** Vue « monde réel » : la carte du jeu cède la place à son équivalent Terre. */
  realWorld: boolean;
  /**
   * Point d'ouverture imposé de la vue réelle (bouton d'une fiche de lieu).
   *
   * Deux formes : des coordonnées réelles exactes quand la fiche en possède, ou
   * une position de jeu que `RealWorldView` transposera par ses voisins — car
   * tout lieu existe dans le monde réel, même ceux dont la correspondance n'a
   * pas encore été relevée. `null` : on transpose depuis le centre de l'écran.
   */
  realWorldTarget:
    | { kind: "real"; lat: number; lng: number; zoom?: number }
    | { kind: "game"; x: number; y: number }
    | null;
  /**
   * Dernière vue de la carte réelle, mémorisée en continu.
   *
   * C'est elle qui permet un aller-retour sans perte : revenir au monde réel
   * après un détour par le jeu retrouve exactement le cadrage quitté, au lieu
   * de le recalculer par transposition — laquelle est approchée et ferait donc
   * dériver la vue un peu plus à chaque bascule.
   */
  realWorldView: { lat: number; lng: number; zoom: number } | null;
  flyToRequest: FlyToRequest | null;
  /** Mise à jour depuis Leaflet (moveend) — ne déclenche pas de flyTo. */
  setView: (center: WorldXY, zoom: number) => void;
  flyTo: (center: WorldXY, zoom?: number) => void;
  consumeFlyTo: () => void;
  setTileSet: (tileSet: TileSetId) => void;
  toggleAreaLabels: () => void;
  toggleGrid: () => void;
  setMapFilter: (id: string) => void;
  setUnit: (unit: "km" | "mi") => void;
  toggleMeasuring: () => void;
  toggleRealWorld: () => void;
  openRealWorldAt: (lat: number, lng: number, zoom?: number) => void;
  openRealWorldFromGame: (x: number, y: number) => void;
  clearRealWorldTarget: () => void;
  setRealWorldView: (view: { lat: number; lng: number; zoom: number }) => void;
}

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      center: DEFAULT_VIEW.center,
      zoom: DEFAULT_VIEW.zoom,
      tileSet: DEFAULT_TILE_SET,
      showAreaLabels: true,
      showGrid: false,
      mapFilter: DEFAULT_MAP_FILTER,
      unit: "km",
      // Jamais persistés : on ne rouvre ni la règle en main, ni sur une autre carte.
      measuring: false,
      realWorld: false,
      realWorldTarget: null,
      realWorldView: null,
      flyToRequest: null,
      setView: (center, zoom) => set({ center, zoom }),
      flyTo: (center, zoom) =>
        set((s) => ({ flyToRequest: { center, zoom, nonce: (s.flyToRequest?.nonce ?? 0) + 1 } })),
      consumeFlyTo: () => set({ flyToRequest: null }),
      setTileSet: (tileSet) => set({ tileSet: tileSet in TILE_SETS ? tileSet : DEFAULT_TILE_SET }),
      toggleAreaLabels: () => set((s) => ({ showAreaLabels: !s.showAreaLabels })),
      toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
      // Un identifiant inconnu (donnée persistée d'une version antérieure)
      // retombe sur le rendu d'origine plutôt que de casser l'affichage.
      setMapFilter: (id) =>
        set({ mapFilter: MAP_FILTERS.some((f) => f.id === id) ? id : DEFAULT_MAP_FILTER }),
      setUnit: (unit) => set({ unit }),
      toggleMeasuring: () => set((s) => ({ measuring: !s.measuring })),
      // La règle n'a pas de sens sur la carte réelle : on la range en basculant.
      // La cible est effacée en basculant : sans cela, une prochaine ouverture
      // depuis les contrôles rouvrirait sur l'ancien lieu au lieu de transposer
      // la vue courante.
      toggleRealWorld: () =>
        set((s) => ({ realWorld: !s.realWorld, measuring: false, realWorldTarget: null })),
      openRealWorldAt: (lat, lng, zoom) =>
        set({ realWorld: true, measuring: false, realWorldTarget: { kind: "real", lat, lng, zoom } }),
      openRealWorldFromGame: (x, y) =>
        set({ realWorld: true, measuring: false, realWorldTarget: { kind: "game", x, y } }),
      clearRealWorldTarget: () => set({ realWorldTarget: null }),
      setRealWorldView: (realWorldView) => set({ realWorldView }),
    }),
    {
      name: "gta6map:view",
      version: 2,
      migrate: () => ({}) as Partial<MapState>,
      partialize: (s) => ({
        center: s.center,
        zoom: s.zoom,
        tileSet: s.tileSet,
        showAreaLabels: s.showAreaLabels,
        showGrid: s.showGrid,
        mapFilter: s.mapFilter,
        unit: s.unit,
      }),
    },
  ),
);
