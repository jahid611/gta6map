"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { Location } from "@/types";
import { frameUrl } from "@/lib/media";
import { useMapStore } from "@/store/useMapStore";
import { useUIStore } from "@/store/useUIStore";
import { Search, X } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { canHover, cn } from "@/lib/utils";

interface MediaLibraryProps {
  locations: readonly Location[];
}

/** Une entrée de la médiathèque : un plan officiel géolocalisé. */
interface MediaEntry {
  slug: string;
  name: string;
  area: string | null;
  source: string;
  thumb: string | null;
  x: number;
  y: number;
  /** Coordonnées réelles confirmées, si la fiche en porte. */
  lat: number | null;
  lng: number | null;
}

const ALL = "Toutes";

/**
 * Médiathèque : parcourir les plans officiels comme une galerie plutôt que de
 * les chercher un par un sur la carte.
 *
 * Les filtres de catégorie de la carte ne s'appliquent pas ici — on liste tout
 * ce qui existe. Masquer une catégorie sert à alléger la carte, pas à amputer la
 * bibliothèque ; l'inverse serait déroutant (« pourquoi la moitié des trailers a
 * disparu ? »).
 *
 * Cliquer sur une vignette sélectionne le lieu et y amène la caméra, ce qui
 * ouvre la fiche habituelle : la médiathèque est une porte d'entrée vers la
 * carte, pas une vue parallèle.
 */
export function MediaLibrary({ locations }: MediaLibraryProps) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<string>(ALL);
  const deferredQuery = useDeferredValue(query);

  // Aperçu agrandi au survol. Les vignettes de la planche font 110 px : assez
  // pour reconnaître un plan déjà vu, pas pour en découvrir un. Un survol
  // prolongé en montre donc une grande version, sans aucun texte — le nom est
  // déjà sous le curseur dans la liste, le répéter encombrerait l'image.
  const [zoom, setZoom] = useState<{ src: string; top: number } | null>(null);
  const zoomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const armZoom = (entry: MediaEntry, el: HTMLElement) => {
    setHovered(entry.slug);
    if (zoomTimer.current) clearTimeout(zoomTimer.current);
    // Au doigt, le tap déclenche aussi `mouseenter` : l'agrandissement s'ouvrait
    // alors par-dessus la fiche, à une position calculée pour le panneau desktop.
    if (!canHover()) return;
    if (!entry.thumb) return;
    // Calé sur la vignette, puis borné pour rester dans la fenêtre : l'aperçu
    // fait environ 270 px de haut une fois le rapport 16/9 appliqué.
    const rect = el.getBoundingClientRect();
    const top = Math.max(70, Math.min(rect.top - 40, window.innerHeight - 300));
    zoomTimer.current = setTimeout(() => setZoom({ src: entry.thumb as string, top }), 320);
  };

  const clearZoom = () => {
    setHovered(null);
    if (zoomTimer.current) clearTimeout(zoomTimer.current);
    setZoom(null);
  };

  useEffect(
    () => () => {
      if (zoomTimer.current) clearTimeout(zoomTimer.current);
    },
    [],
  );

  const selectLocation = useUIStore((s) => s.selectLocation);
  const selectedSlug = useUIStore((s) => s.selectedSlug);
  const setHovered = useUIStore((s) => s.setHovered);
  const flyTo = useMapStore((s) => s.flyTo);
  const realWorld = useMapStore((s) => s.realWorld);
  const openRealWorldAt = useMapStore((s) => s.openRealWorldAt);
  const openRealWorldFromGame = useMapStore((s) => s.openRealWorldFromGame);

  const entries = useMemo<MediaEntry[]>(
    () =>
      locations
        .filter((l) => l.kind === "camera" && l.media)
        .map((l) => ({
          slug: l.slug,
          name: l.name,
          area: l.area ?? null,
          source: l.media?.sourceLabel ?? "",
          thumb: frameUrl(l.media?.thumb),
          x: l.x,
          y: l.y,
          lat: l.realWorld?.lat ?? null,
          lng: l.realWorld?.lng ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [locations],
  );

  const sources = useMemo(() => [ALL, ...new Set(entries.map((e) => e.source).filter(Boolean))], [entries]);

  const results = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (source === ALL || e.source === source) &&
        (!q || e.name.toLowerCase().includes(q) || (e.area ?? "").toLowerCase().includes(q)),
    );
  }, [entries, deferredQuery, source]);

  /**
   * Planche par source, façon « frames reference ».
   *
   * Le fond de carte imprime une planche équivalente dans ses propres tuiles,
   * mais ce ne sont que des pixels : ni zone cliquable, ni coordonnées. Elle
   * contient d'ailleurs des plans jamais placés sur la carte (≈ 46 vignettes
   * pour Trailer 2, contre 27 géolocalisées ici). Celle-ci est la version
   * utile : chaque vignette mène à son emplacement.
   */
  const groups = useMemo(() => {
    const order = ["Trailer 1", "Trailer 2", "Screenshot officiel"];
    const map = new Map<string, MediaEntry[]>();
    for (const e of results) map.set(e.source, [...(map.get(e.source) ?? []), e]);
    return [...map.entries()].sort(
      (a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99),
    );
  }, [results]);

  const open = (entry: MediaEntry) => {
    // `keepPanel` : on reste dans la médiathèque pour pouvoir enchaîner les
    // plans ; la fiche du lieu s'ouvre par-dessus la carte.
    selectLocation(entry.slug, { keepPanel: true });

    // On mène vers la carte que l'utilisateur regarde. Depuis la vue réelle,
    // déplacer la carte du jeu cachée derrière donnerait l'impression que le
    // clic n'a rien fait.
    if (realWorld) {
      if (entry.lat !== null && entry.lng !== null) openRealWorldAt(entry.lat, entry.lng, 17);
      else openRealWorldFromGame(entry.x, entry.y);
    } else {
      flyTo([entry.x, entry.y], 6);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Rendu dans un portail vers `document.body`.

          `position: fixed` ne suffit pas : le panneau latéral défile dans un
          conteneur qui établit un bloc conteneur, lequel rognait l'aperçu à
          quelques pixels de large. Un portail le sort de cette chaîne d'ancêtres.

          `pointer-events-none` pour ne jamais intercepter le survol de la
          vignette qui l'a ouvert. */}
      {zoom &&
        createPortal(
          <div
            aria-hidden
            className="rs-menu pointer-events-none fixed left-[352px] z-[1300] w-[460px] overflow-hidden rounded-2xl p-1.5"
            style={{ top: zoom.top }}
          >
            <Image
              src={zoom.src}
              alt=""
              width={920}
              height={518}
              quality={90}
              sizes="460px"
              className="h-auto w-full rounded-xl"
            />
          </div>,
          document.body,
        )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un plan…"
          aria-label="Rechercher dans la médiathèque"
          className="h-9 w-full rounded-lg border border-border bg-surface-2 pl-9 pr-8 text-sm placeholder:text-muted-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Effacer la recherche"
            className="absolute right-2 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <Select label="Source" value={source} onChange={setSource} options={sources.map((s) => ({ value: s, label: s }))} />

      <p className="text-[11px] text-muted-2">
        {results.length} plan{results.length > 1 ? "s" : ""} sur {entries.length}
      </p>

      {results.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted">
          Aucun plan ne correspond.
        </p>
      ) : (
        groups.map(([label, items]) => (
          <section key={label}>
            <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {label}
              <span className="vi-num font-normal text-muted-2">{items.length}</span>
            </h3>

            <ul className="grid grid-cols-3 gap-1.5">
              {items.map((entry) => (
                <li key={entry.slug}>
                  <button
                    onClick={() => open(entry)}
                    onMouseEnter={(e) => armZoom(entry, e.currentTarget)}
                    onMouseLeave={clearZoom}
                    onFocus={(e) => armZoom(entry, e.currentTarget)}
                    onBlur={clearZoom}
                    aria-label={`${entry.name}${entry.area ? ` — ${entry.area}` : ""} : voir sur la carte`}
                    className={cn(
                      "group relative block aspect-video w-full overflow-hidden rounded-md border transition-all",
                      selectedSlug === entry.slug
                        ? "border-accent ring-1 ring-accent"
                        : "border-transparent hover:border-border-strong",
                    )}
                  >
                    {entry.thumb ? (
                      <Image
                        src={entry.thumb}
                        alt={entry.name}
                        fill
                        sizes="110px"
                        className="object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center bg-surface-3 text-[10px] text-muted-2">
                        —
                      </span>
                    )}

                    {/* Nom au survol seulement : sous 110 px de large, un libellé
                        permanent tiendrait plus de place que la vignette. */}
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/90 to-transparent px-1 pb-0.5 pt-3 text-left text-[9px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {entry.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
