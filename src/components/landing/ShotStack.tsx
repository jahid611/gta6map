"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, MapPin } from "@/components/ui/icons";
import type { StackShot } from "@/lib/landing-stats";

/**
 * Les plans officiels en pile, d'après `uilayout.contact/stacking-card`
 * (21st.dev) : chaque carte se colle en haut de l'écran et rétrécit à mesure que
 * la suivante vient la recouvrir, ne laissant dépasser que sa tranche.
 *
 * Deux dépendances de l'original écartées :
 *
 *  - `lenis`, un défilement adouci appliqué à la page entière. Il ne sert qu'au
 *    confort de l'effet, et détourner le défilement de tout le site pour une
 *    section serait payer très cher un agrément ;
 *  - `motion`, alors que GSAP et son `ScrollTrigger` sont déjà chargés pour le
 *    hero. Deux moteurs d'animation liés au défilement sur la même page, c'est
 *    deux façons concurrentes de mesurer la position.
 *
 * L'empilement lui-même ne doit rien à personne : c'est `position: sticky` sur
 * des conteneurs pleine hauteur. Le défilement n'anime que l'échelle.
 */
export function ShotStack({ shots }: { shots: StackShot[] }) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (shots.length === 0) return;
    // Sous mouvement réduit, les cartes s'empilent toujours — c'est le collant
    // qui le fait, pas l'animation — mais plus rien ne bouge à l'échelle.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>("[data-stack-card]");
      cards.forEach((card, i) => {
        // Chaque carte finit un peu plus petite que celle qui la recouvre : la
        // pile se lit alors comme une profondeur, et non comme un tas.
        gsap.fromTo(
          card,
          { scale: 1 },
          {
            scale: 1 - (cards.length - 1 - i) * 0.04,
            ease: "none",
            scrollTrigger: {
              trigger: card.parentElement,
              start: "top top",
              endTrigger: sectionRef.current,
              end: "bottom bottom",
              scrub: true,
              invalidateOnRefresh: true,
            },
          },
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [shots.length]);

  if (shots.length === 0) return null;

  return (
    <section ref={sectionRef} id="plans" className="relative scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="vi-reveal mx-auto max-w-2xl text-center">
          <p className="vi-kicker text-accent">Plans officiels</p>
          <h2 className="vi-display mt-5 text-[clamp(2rem,5.5vw,3.75rem)]">
            Chaque image,
            <br />à sa place exacte
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted">
            Les plans des bandes-annonces et des screenshots Rockstar, replacés sur la carte avec l&apos;orientation
            exacte de la caméra.
          </p>
        </div>
      </div>

      {shots.map((shot, i) => (
        <div key={shot.slug} className="sticky top-0 flex h-screen items-center justify-center px-5">
          <article
            data-stack-card
            // Fond dense et non le verre courant : les cartes se recouvrent, et
            // à travers une surface translucide on verrait l'image de celle du
            // dessous — la pile virerait à la bouillie.
            style={{ background: "var(--menu-bg)", top: `${i * 26}px` }}
            className="rs-card relative w-full max-w-5xl origin-top overflow-hidden rounded-3xl p-6 md:p-8"
          >
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-10">
              <div className="md:w-[42%]">
                <p className="vi-kicker text-accent-pale">{shot.sourceLabel}</p>
                <h3 className="rs-title mt-2 text-2xl leading-tight text-foreground md:text-3xl">{shot.name}</h3>
                {shot.area && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {shot.area}
                  </p>
                )}
                <p className="mt-4 text-sm leading-relaxed text-muted md:text-[15px]">{shot.blurb}</p>
                <Link
                  href={`/map?l=${encodeURIComponent(shot.slug)}`}
                  className="group mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-transform hover:scale-[1.03] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Voir sur la carte
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>

              <div className="relative aspect-video overflow-hidden rounded-2xl md:w-[58%]">
                {shot.image && (
                  <Image
                    src={shot.image}
                    alt=""
                    fill
                    quality={92}
                    // Sur-échantillonné : la carte fait jusqu'à 600 px de large,
                    // et une image au pixel près y paraît molle (cf. les
                    // portraits de l'accueil).
                    sizes="(max-width: 768px) 100vw, 1200px"
                    className="object-cover"
                  />
                )}
              </div>
            </div>
          </article>
        </div>
      ))}
    </section>
  );
}
