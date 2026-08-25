"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "@/components/ui/icons";
import type { InteractiveMapProps } from "./InteractiveMap";

/**
 * Leaflet accède à `window` à l'import : on désactive le SSR pour la carte
 * uniquement (le reste de la page — header, SEO, données — est rendu côté serveur).
 */
const InteractiveMap = dynamic(() => import("./InteractiveMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#04070a] text-muted">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Chargement de la carte…
    </div>
  ),
});

export function MapLoader(props: InteractiveMapProps) {
  return <InteractiveMap {...props} />;
}
