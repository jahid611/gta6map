import { create } from "zustand";

export type SidebarPanel = "filters" | "location" | "progress";

interface UIState {
  /** Slug du lieu sélectionné (source de vérité pour le drawer + l'URL `?l=`). */
  selectedSlug: string | null;
  /** Lieu survolé (liste / carte) pour mise en évidence. */
  hoveredSlug: string | null;
  sidebarOpen: boolean;
  activePanel: SidebarPanel;
  searchOpen: boolean;
  /** Point monde en attente pour un marqueur personnalisé (clic droit / appui long). */
  pendingCustomMarker: { x: number; y: number } | null;

  selectLocation: (slug: string | null, opts?: { openPanel?: boolean }) => void;
  setHovered: (slug: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setActivePanel: (panel: SidebarPanel) => void;
  setSearchOpen: (open: boolean) => void;
  setPendingCustomMarker: (point: { x: number; y: number } | null) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  selectedSlug: null,
  hoveredSlug: null,
  sidebarOpen: true,
  activePanel: "filters",
  searchOpen: false,
  pendingCustomMarker: null,

  selectLocation: (slug, opts) =>
    set((s) => ({
      selectedSlug: slug,
      activePanel: slug ? "location" : s.activePanel === "location" ? "filters" : s.activePanel,
      sidebarOpen: slug && (opts?.openPanel ?? true) ? true : s.sidebarOpen,
    })),
  setHovered: (hoveredSlug) => set({ hoveredSlug }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActivePanel: (activePanel) => set({ activePanel, sidebarOpen: true }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setPendingCustomMarker: (pendingCustomMarker) => set({ pendingCustomMarker }),
}));
