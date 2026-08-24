import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TileSetId, WorldXY } from "@/types/map";
import { DEFAULT_TILE_SET, DEFAULT_VIEW, TILE_SETS } from "@/lib/map/config";

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
  flyToRequest: FlyToRequest | null;
  /** Mise à jour depuis Leaflet (moveend) — ne déclenche pas de flyTo. */
  setView: (center: WorldXY, zoom: number) => void;
  flyTo: (center: WorldXY, zoom?: number) => void;
  consumeFlyTo: () => void;
  setTileSet: (tileSet: TileSetId) => void;
  toggleAreaLabels: () => void;
}

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      center: DEFAULT_VIEW.center,
      zoom: DEFAULT_VIEW.zoom,
      tileSet: DEFAULT_TILE_SET,
      showAreaLabels: true,
      flyToRequest: null,
      setView: (center, zoom) => set({ center, zoom }),
      flyTo: (center, zoom) =>
        set((s) => ({ flyToRequest: { center, zoom, nonce: (s.flyToRequest?.nonce ?? 0) + 1 } })),
      consumeFlyTo: () => set({ flyToRequest: null }),
      setTileSet: (tileSet) => set({ tileSet: tileSet in TILE_SETS ? tileSet : DEFAULT_TILE_SET }),
      toggleAreaLabels: () => set((s) => ({ showAreaLabels: !s.showAreaLabels })),
    }),
    {
      name: "gta6map:view",
      version: 2,
      migrate: () => ({}) as Partial<MapState>,
      partialize: (s) => ({ center: s.center, zoom: s.zoom, tileSet: s.tileSet, showAreaLabels: s.showAreaLabels }),
    },
  ),
);
