import { create } from "zustand";

export type SidebarPanel = "filters" | "media" | "location" | "progress";

interface UIState {
  /** Slug du lieu sélectionné (source de vérité pour le drawer + l'URL `?l=`). */
  selectedSlug: string | null;
  /** Lieu survolé (liste / carte) pour mise en évidence. */
  hoveredSlug: string | null;
  /** Aperçu au survol prolongé d'un marqueur : slug + position à l'écran (px). */
  hoverPreview: { slug: string; x: number; y: number } | null;
  sidebarOpen: boolean;
  activePanel: SidebarPanel;
  searchOpen: boolean;
  /** Point monde en attente pour un marqueur personnalisé (clic droit / appui long). */
  pendingCustomMarker: { x: number; y: number } | null;

  selectLocation: (slug: string | null, opts?: { openPanel?: boolean; keepPanel?: boolean }) => void;
  setHovered: (slug: string | null) => void;
  setHoverPreview: (preview: { slug: string; x: number; y: number } | null) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setActivePanel: (panel: SidebarPanel) => void;
  setSearchOpen: (open: boolean) => void;
  setPendingCustomMarker: (point: { x: number; y: number } | null) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  selectedSlug: null,
  hoveredSlug: null,
  hoverPreview: null,
  sidebarOpen: true,
  activePanel: "filters",
  searchOpen: false,
  pendingCustomMarker: null,

  selectLocation: (slug, opts) =>
    set((s) => ({
      selectedSlug: slug,
      // Un clic ouvre la fiche complète : l'aperçu de survol n'a plus lieu d'être.
      hoverPreview: null,
      // `keepPanel` : sélectionner depuis la médiathèque ne doit pas refermer
      // l'onglet d'où vient le clic. La fiche du lieu s'affiche de toute façon
      // en surimpression de la carte, pas dans le panneau latéral.
      activePanel: opts?.keepPanel
        ? s.activePanel
        : slug
          ? "location"
          : s.activePanel === "location"
            ? "filters"
            : s.activePanel,
      sidebarOpen: slug && (opts?.openPanel ?? true) ? true : s.sidebarOpen,
    })),
  setHovered: (hoveredSlug) => set({ hoveredSlug }),
  setHoverPreview: (hoverPreview) => set({ hoverPreview }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActivePanel: (activePanel) => set({ activePanel, sidebarOpen: true }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setPendingCustomMarker: (pendingCustomMarker) => set({ pendingCustomMarker }),
}));
