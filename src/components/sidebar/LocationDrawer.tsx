"use client";

import { X } from "lucide-react";
import type { Category, Location, LocationWiki } from "@/types";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { useUIStore } from "@/store/useUIStore";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LocationDetails } from "./LocationDetails";

interface LocationDrawerProps {
  location: Location | null;
  categoriesBySlug: ReadonlyMap<string, Category>;
  /** Fiche wiki de la zone (résolue côté client). */
  areaWiki?: LocationWiki | null;
}

/**
 * Détails du lieu sélectionné :
 *  - desktop : carte flottante à droite de la carte (au-dessus des panes Leaflet, z-index > 1000)
 *  - mobile / tablette : bottom-sheet rétractable (Radix Dialog)
 */
export function LocationDrawer({ location, categoriesBySlug, areaWiki = null }: LocationDrawerProps) {
  const isDesktop = useIsDesktop();
  const selectLocation = useUIStore((s) => s.selectLocation);
  if (!location) return null;
  const category = categoriesBySlug.get(location.categorySlug);

  if (isDesktop) {
    return (
      <aside
        className="rs-card absolute right-3 top-3 bottom-3 z-[1050] flex w-[400px] flex-col overflow-hidden rounded-3xl animate-fade-in"
        aria-label={`Détails : ${location.name}`}
      >
        <button
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-accent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={() => selectLocation(null)}
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
        <ScrollArea className="h-full">
          <LocationDetails key={location.id} location={location} category={category} areaWiki={areaWiki} />
        </ScrollArea>
      </aside>
    );
  }

  return (
    <Sheet open onOpenChange={(open) => !open && selectLocation(null)}>
      <SheetContent side="bottom" title={location.name} description={category?.name}>
        <ScrollArea className="max-h-[calc(85dvh-1.5rem)]">
          <LocationDetails key={location.id} location={location} category={category} areaWiki={areaWiki} />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
