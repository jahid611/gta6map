import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FilterState {
  /** Catégories masquées (par défaut tout est visible → on stocke les exclusions). */
  hiddenCategories: string[];
  hideFound: boolean;
  /** Recherche courante (barre de recherche). */
  query: string;
  toggleCategory: (slug: string) => void;
  setCategoryVisible: (slug: string, visible: boolean) => void;
  showOnly: (slugs: string[], all: string[]) => void;
  showAll: () => void;
  hideAll: (all: string[]) => void;
  setHideFound: (value: boolean) => void;
  setQuery: (query: string) => void;
  isVisible: (slug: string) => boolean;
}

export const useFilterStore = create<FilterState>()(
  persist(
    (set, get) => ({
      hiddenCategories: [],
      hideFound: false,
      query: "",
      toggleCategory: (slug) =>
        set((s) => ({
          hiddenCategories: s.hiddenCategories.includes(slug)
            ? s.hiddenCategories.filter((c) => c !== slug)
            : [...s.hiddenCategories, slug],
        })),
      setCategoryVisible: (slug, visible) =>
        set((s) => ({
          hiddenCategories: visible
            ? s.hiddenCategories.filter((c) => c !== slug)
            : s.hiddenCategories.includes(slug)
              ? s.hiddenCategories
              : [...s.hiddenCategories, slug],
        })),
      showOnly: (slugs, all) => set({ hiddenCategories: all.filter((c) => !slugs.includes(c)) }),
      showAll: () => set({ hiddenCategories: [] }),
      hideAll: (all) => set({ hiddenCategories: [...all] }),
      setHideFound: (hideFound) => set({ hideFound }),
      setQuery: (query) => set({ query }),
      isVisible: (slug) => !get().hiddenCategories.includes(slug),
    }),
    {
      name: "gta6map:filters",
      partialize: (s) => ({ hiddenCategories: s.hiddenCategories, hideFound: s.hideFound }),
    },
  ),
);
