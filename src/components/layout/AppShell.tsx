"use client";

import { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Camera, SlidersHorizontal, Trophy } from "@/components/ui/icons";
import type { AreaInfo, Category, CategoryWithCount, Location, LocationWiki, MapSection, ProgressSummary } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useProgressSync } from "@/hooks/useProgressSync";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { useFilterStore } from "@/store/useFilterStore";
import { useMapStore } from "@/store/useMapStore";
import { useProgressStore } from "@/store/useProgressStore";
import { useUIStore, type SidebarPanel } from "@/store/useUIStore";
import { MapLoader } from "@/components/map/MapLoader";
import { CustomMarkerDialog } from "@/components/map/CustomMarkerDialog";
import { LocationDrawer } from "@/components/sidebar/LocationDrawer";
import { MarkerPreview } from "@/components/map/MarkerPreview";
// Leaflet touche `window` dès son import : la vue réelle est chargée sans rendu
// serveur, comme la carte principale via `MapLoader`. Sans cela, `/map` renvoie
// une 500 au pré-rendu.
const RealWorldView = dynamic(
  () => import("@/components/map/RealWorldView").then((m) => m.RealWorldView),
  { ssr: false },
);
import { CategoryFilters } from "@/components/filters/CategoryFilters";
import { MediaLibrary } from "@/components/media/MediaLibrary";
import { ProgressOverview } from "@/components/progress/ProgressOverview";
import { Header } from "./Header";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AppShellProps {
  locations: Location[];
  categories: Category[];
  sections: MapSection[];
  areas: AreaInfo[];
  /** Slug pré-sélectionné depuis l'URL `?l=` (rendu serveur). */
  initialSlug?: string | null;
}

const PANEL_TABS: { id: Exclude<SidebarPanel, "location">; label: string; icon: typeof Trophy }[] = [
  { id: "filters", label: "Filtres", icon: SlidersHorizontal },
  { id: "media", label: "Médias", icon: Camera },
  { id: "progress", label: "Progression", icon: Trophy },
];

/**
 * Shell applicatif : orchestre données, filtres, progression, layout responsive.
 *  - Desktop (≥ 1024px) : sidebar gauche (filtres / progression) + fiche lieu superposée
 *  - Mobile / tablette : carte plein écran, filtres en sheet, lieu en bottom-sheet
 */
export function AppShell({ locations, categories, sections, areas, initialSlug = null }: AppShellProps) {
  const isDesktop = useIsDesktop();
  // `/map?share=1` : venu du chat pour choisir un lieu à partager (bandeau d'aide).
  const shareMode = useSearchParams().get("share") === "1";
  const auth = useAuth();
  useProgressSync(auth.user?.id ?? null);

  const hiddenCategories = useFilterStore((s) => s.hiddenCategories);
  const hideFound = useFilterStore((s) => s.hideFound);
  const entries = useProgressStore((s) => s.entries);
  const dirtyCount = useProgressStore((s) => s.dirty.length);
  const selectedSlug = useUIStore((s) => s.selectedSlug);
  const selectLocation = useUIStore((s) => s.selectLocation);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const activePanel = useUIStore((s) => s.activePanel);
  const setActivePanel = useUIStore((s) => s.setActivePanel);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const flyTo = useMapStore((s) => s.flyTo);

  const categoriesBySlug = useMemo(() => new Map(categories.map((c) => [c.slug, c])), [categories]);
  const locationBySlug = useMemo(() => new Map(locations.map((l) => [l.slug, l])), [locations]);
  // Quartiers (labels secondaires) : zones avec ≥ 6 lieux
  const districts = useMemo(() => areas.filter((a) => a.count >= 6).map(({ name, x, y }) => ({ name, x, y })), [areas]);

  // Lieux affichés sur la carte (filtres catégorie + « masquer trouvés »)
  const visibleLocations = useMemo(() => {
    const hidden = new Set(hiddenCategories);
    return locations.filter((l) => !hidden.has(l.categorySlug) && !(hideFound && entries[l.id]?.found));
  }, [locations, hiddenCategories, hideFound, entries]);

  // Compteurs par catégorie + complétion
  const { categoriesWithCounts, global } = useMemo(() => {
    const totals = new Map<string, { total: number; found: number }>();
    for (const l of locations) {
      const t = totals.get(l.categorySlug) ?? { total: 0, found: 0 };
      t.total += 1;
      if (entries[l.id]?.found) t.found += 1;
      totals.set(l.categorySlug, t);
    }
    const withCounts: CategoryWithCount[] = categories.map((c) => ({
      ...c,
      total: totals.get(c.slug)?.total ?? 0,
      found: totals.get(c.slug)?.found ?? 0,
    }));
    const trackable = withCounts.filter((c) => c.trackable);
    const total = trackable.reduce((n, c) => n + c.total, 0);
    const found = trackable.reduce((n, c) => n + c.found, 0);
    const summary: ProgressSummary = { total, found, percent: total ? (found / total) * 100 : 0 };
    return { categoriesWithCounts: withCounts, global: summary };
  }, [locations, categories, entries]);

  const selectedLocation = selectedSlug ? (locationBySlug.get(selectedSlug) ?? null) : null;
  // Fiche wiki de zone résolue côté client (payload allégé) : zone du lieu → `areas`
  const areaWikiByName = useMemo(
    () =>
      new Map<string, LocationWiki | null>([
        ...sections.map((s) => [s.name.toLowerCase(), s.wiki] as const),
        ...areas.map((a) => [a.name.toLowerCase(), a.wiki] as const),
      ]),
    [areas, sections],
  );
  const selectedAreaWiki = selectedLocation
    ? (selectedLocation.areaWiki ?? areaWikiByName.get((selectedLocation.area ?? "").split(", ")[0].toLowerCase()) ?? null)
    : null;

  // Deep link initial `?l=slug` → sélection + centrage
  useEffect(() => {
    if (!initialSlug) return;
    const loc = locationBySlug.get(initialSlug);
    if (!loc) return;
    selectLocation(loc.slug);
    const t = setTimeout(() => flyTo([loc.x, loc.y], 6), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSlug]);

  // Sélection → URL `?l=` (sans rechargement, conserve le hash de vue)
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedSlug) url.searchParams.set("l", selectedSlug);
    else url.searchParams.delete("l");
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, "", next);
    }
  }, [selectedSlug]);

  // Mobile : le panneau ne s'ouvre que depuis le header. Il est refermé au
  // chargement, et à chaque sélection ou fermeture de fiche — sinon, après avoir
  // fermé la fiche d'un lieu, on retombait sur « Filtres / Médias / Progression »
  // qu'il fallait fermer à son tour.
  useEffect(() => {
    if (!isDesktop) setSidebarOpen(false);
  }, [isDesktop, selectedSlug, setSidebarOpen]);

  // Échap → désélection
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedSlug) selectLocation(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedSlug, selectLocation]);

  const syncStatus = !auth.user ? "local" : dirtyCount > 0 ? "pending" : "synced";

  const sidebarPanel = (
    <>
      {/* `pr-12` sur mobile : la croix de fermeture de la feuille est posée en
          haut à droite et mordait sur l'onglet « Progression ». */}
      <div className={cn("flex shrink-0 border-b border-border", !isDesktop && "pr-12")}>
        {PANEL_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActivePanel(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 px-3 py-3 text-sm font-semibold transition-colors cursor-pointer",
              activePanel === id ? "border-b-2 border-accent text-foreground" : "text-muted hover:text-foreground",
            )}
            aria-selected={activePanel === id}
            role="tab"
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      {/* Défilement natif : le conteneur Radix ne défilait pas au doigt. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {activePanel === "progress" ? (
          <ProgressOverview categories={categoriesWithCounts} global={global} syncStatus={syncStatus} />
        ) : activePanel === "media" ? (
          // `locations` et non `visibleLocations` : masquer une catégorie allège
          // la carte, ça n'ampute pas la bibliothèque.
          <MediaLibrary locations={locations} />
        ) : (
          <CategoryFilters categories={categoriesWithCounts} />
        )}
      </div>
    </>
  );

  const mobilePanelOpen = !isDesktop && sidebarOpen && activePanel !== "location";

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-dvh flex-col overflow-hidden">
        <Header locations={locations} categoriesBySlug={categoriesBySlug} global={global} auth={auth} />

        <div className="relative flex min-h-0 flex-1">
          {isDesktop && sidebarOpen && (
            <aside className="relative z-10 flex w-[340px] shrink-0 flex-col border-r border-border bg-surface" aria-label="Panneau latéral">
              {sidebarPanel}
            </aside>
          )}

          <main className="relative min-w-0 flex-1">
            {shareMode && (
              <div className="pointer-events-none absolute inset-x-0 top-3 z-[1060] flex justify-center px-3">
                <div className="rs-card pointer-events-auto flex max-w-xl items-center gap-3 rounded-full py-2 pl-4 pr-2 text-sm animate-fade-in">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-white">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="font-semibold">Mode partage</span>
                    <span className="text-muted"> — parcourez la carte, ouvrez un lieu et cliquez « Partager ce lieu ».</span>
                  </span>
                  <Link href="/community" className="rs-pill shrink-0 px-3 py-1.5 text-xs font-semibold">
                    Annuler
                  </Link>
                </div>
              </div>
            )}
            <MapLoader
              locations={visibleLocations}
              categoriesBySlug={categoriesBySlug}
              sections={sections}
              districts={districts}
            />
            <LocationDrawer location={selectedLocation} categoriesBySlug={categoriesBySlug} areaWiki={selectedAreaWiki} />
            <MarkerPreview locations={locations} categoriesBySlug={categoriesBySlug} />
            <RealWorldView locations={locations} categoriesBySlug={categoriesBySlug} />
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-background/85 px-3 py-1 text-[11px] text-muted backdrop-blur md:hidden">
              {visibleLocations.length} points · {Math.round(global.percent)} %
            </div>
          </main>
        </div>

        {!isDesktop && (
          <Sheet open={mobilePanelOpen} onOpenChange={setSidebarOpen}>
            <SheetContent
              side="bottom"
              title={activePanel === "progress" ? "Progression" : activePanel === "media" ? "Médias" : "Filtres"}
              className="h-[75dvh]"
            >
              {sidebarPanel}
            </SheetContent>
          </Sheet>
        )}

        <CustomMarkerDialog />
      </div>
    </TooltipProvider>
  );
}
