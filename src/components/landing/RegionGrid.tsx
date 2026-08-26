import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "@/components/ui/icons";
import type { LandingRegion } from "@/lib/landing-stats";
import { Carousel } from "./Carousel";

/**
 * Les 8 régions de Leonida, en carrousel, ordonnées par densité de lieux.
 *
 * Chaque carte est illustrée par une image de la région (plan officiel tourné
 * sur place, à défaut la vignette wiki — voir `regionImage` dans landing-stats).
 * Le texte passe sur un dégradé dense en pied de carte : les plans in-game sont
 * clairs et contrastés, un simple voile uniforme ne suffisait pas.
 */
export function RegionGrid({ regions }: { regions: LandingRegion[] }) {
  return (
    <Carousel
      id="regions"
      kicker="L'État de Leonida"
      title={
        <>
          Huit régions,
          <br />
          une seule carte
        </>
      }
      lead="Des néons de Vice City aux marécages de Mount Kalaga. Chaque point est positionné en coordonnées monde (mètres RAGE), pas approximé à la main sur une capture d'écran."
    >
      {regions.map((region) => (
        <li key={region.slug} className="w-[80vw] shrink-0 snap-start sm:w-[24rem]">
          <Link
            href="/map"
            className="group relative isolate flex h-[26rem] flex-col justify-end overflow-hidden rounded-2xl border border-border p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {region.image ? (
              <Image
                src={region.image}
                alt=""
                fill
                // La carte fait 384 × 416 : les visuels sont fournis au format
                // carré (cf. `regionImage`), le recadrage reste donc marginal.
                // `quality` explicite : le défaut de next/image (75) délavait
                // les aplats de la carte et les dégradés des cartes postales.
                quality={92}
                sizes="(max-width: 640px) 80vw, 24rem"
                className="absolute inset-0 z-0 object-cover object-center transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <span aria-hidden className="absolute inset-0 z-0 bg-surface-2" />
            )}

            <span
              aria-hidden
              className="absolute inset-0 z-[1] bg-gradient-to-t from-black/92 via-black/55 to-black/15 transition-opacity group-hover:from-black/95"
            />

            <span className="relative z-10">
              <span className="flex items-start justify-between gap-3">
                <span className="rs-title min-w-0 text-lg leading-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.8)] sm:text-xl">
                  {region.name}
                </span>
                <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-white/60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
              </span>

              <span className="mt-1 block vi-num text-xs  text-accent">
                {region.count.toLocaleString("fr-FR")} lieux
              </span>

              {region.blurb && (
                <span className="mt-3 line-clamp-3 block text-sm leading-relaxed text-white/75">{region.blurb}</span>
              )}

              {region.districts.length > 0 && (
                <span className="mt-4 flex flex-wrap gap-1.5">
                  {region.districts.map((d) => (
                    <span
                      key={d}
                      className="rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[11px] text-white/85 backdrop-blur-sm"
                    >
                      {d}
                    </span>
                  ))}
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </Carousel>
  );
}
