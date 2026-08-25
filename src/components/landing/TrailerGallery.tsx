import Image from "next/image";
import Link from "next/link";
import { MapPin } from "@/components/ui/icons";
import type { ShowcaseShot } from "@/lib/landing-stats";
import { Carousel } from "./Carousel";

/**
 * Galerie des plans officiels géolocalisés, en carrousel.
 *
 * `alt=""` sur les vignettes : le nom du plan et sa zone sont juste en dessous,
 * en texte. Répéter le nom dans l'attribut ferait lire deux fois la même chose
 * par un lecteur d'écran — le libellé du lien porte déjà l'information.
 */
export function TrailerGallery({ shots }: { shots: ShowcaseShot[] }) {
  if (shots.length === 0) return null;

  return (
    <Carousel
      kicker="Plans officiels"
      title={
        <>
          Chaque image,
          <br />à sa place exacte
        </>
      }
      lead="Les plans des trailers et screenshots Rockstar, replacés sur la carte avec l'orientation exacte de la caméra. Cliquez pour y aller."
    >
      {shots.map((shot) => (
        <li key={shot.slug} className="w-[80vw] shrink-0 snap-start sm:w-[30rem]">
          <Link
            href={`/map?l=${encodeURIComponent(shot.slug)}`}
            className="group block focus-visible:outline-none"
            aria-label={`${shot.name}${shot.area ? `, ${shot.area}` : ""} — voir sur la carte`}
          >
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-surface-2 group-focus-visible:ring-2 group-focus-visible:ring-accent">
              {shot.image && (
                <Image
                  src={shot.image}
                  alt=""
                  fill
                  quality={90}
                  sizes="(max-width: 640px) 80vw, 30rem"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
              )}
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-85 transition-opacity group-hover:opacity-95"
              />
              <span className="vi-kicker absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1.5 text-white backdrop-blur">
                {shot.sourceLabel}
              </span>
              <span aria-hidden className="absolute inset-x-4 bottom-4">
                <span className="block truncate text-base font-semibold text-white">{shot.name}</span>
                {shot.area && (
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-white/70">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{shot.area}</span>
                  </span>
                )}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </Carousel>
  );
}
