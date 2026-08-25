"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, ChevronDown, MapPin } from "@/components/ui/icons";

interface HeroProps {
  locationCount: number;
  regionCount: number;
}

/**
 * Hero à révélation par masque, repris de `adrianhajdin/jsm_gta_vi_landing`.
 *
 * La section est épinglée sur deux hauteurs d'écran ; pendant ce temps le
 * wordmark, appliqué en masque alpha sur la carte de Leonida, passe de 3500 % à
 * 20 % : l'image plein écran se résorbe dans les lettres de « GRAND THEFT AUTO
 * VI », puis s'efface. Le mouvement vient du masque et non de l'opacité — c'est
 * ce qui donne la sensation de plongée plutôt qu'un simple fondu.
 *
 * Empilement : `isolate` + z positifs uniquement. `globals.css` pose un fond sur
 * `html` ET sur `body` ; celui de `body` ne se propage donc pas au canvas et
 * recouvrirait tout descendant en z négatif.
 *
 * Repli : sous `prefers-reduced-motion`, rien n'est épinglé et le CSS neutralise
 * `.vi-mask` — la page se lit comme une page statique ordinaire.
 */
export function Hero({ locationCount, regionCount }: HeroProps) {
  const rootRef = useRef<HTMLElement>(null);
  const maskRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const intro = gsap.from(".hero-stagger", {
        y: 26,
        opacity: 0,
        duration: 0.85,
        ease: "expo.out",
        stagger: 0.09,
        delay: 0.2,
        clearProps: "all",
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: rootRef.current,
          start: "top top",
          end: "+=200%",
          scrub: 1.4,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          // Si l'on scrolle pendant l'intro, on la termine d'un coup : sinon les
          // deux animations se disputent les mêmes propriétés du logo.
          onUpdate: (self) => {
            if (self.progress > 0 && intro.isActive()) intro.progress(1);
          },
        },
      });

      // Toutes les étapes sont des `fromTo` avec valeurs de départ explicites :
      // un `.to()` mémorise la valeur courante au premier rendu, et si le scroll
      // démarre pendant l'intro (logo encore transparent), c'est cette opacité
      // quasi nulle qui est « restaurée » en remontant tout en haut — le logo
      // semble alors disparaître. Avec des bornes fixes, progress 0 = état initial.
      const step = { ease: "power1.inOut", immediateRender: false } as const;
      tl
        // Le texte part en premier : il deviendrait illisible dès que l'image
        // commence à se découper derrière lui.
        .fromTo(".hero-stagger", { opacity: 1, y: 0 }, { opacity: 0, y: -30, ...step }, 0)
        // Le voile ne servait qu'à garder ce texte lisible sur la carte. Une
        // fois le texte parti, il ne fait plus qu'assombrir la découpe : on le
        // retire au même rythme.
        .fromTo(scrimRef.current, { opacity: 1 }, { opacity: 0, ...step }, 0)
        // Et la carte reprend sa pleine luminosité, pour que la forme découpée
        // ressorte au lieu de virer au noir.
        .fromTo(
          mapRef.current,
          { filter: "brightness(0.55) saturate(0.8) contrast(1.08)", scale: 1 },
          { filter: "brightness(1) saturate(1) contrast(1.05)", scale: 1.5, ...step },
          0,
        )
        // Le masque se resserre pendant que la carte grandit : les deux
        // mouvements en sens inverse accentuent la plongée.
        .fromTo(
          maskRef.current,
          { maskSize: "3500% 3500%", webkitMaskSize: "3500% 3500%", opacity: 1 },
          { maskSize: "26% 26%", webkitMaskSize: "26% 26%", ...step },
          0,
        )
        // Puis tout s'efface et laisse place à la section suivante.
        .fromTo(maskRef.current, { opacity: 1 }, { opacity: 0, ...step }, 0.88);
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      className="relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-5 pb-20 pt-24"
    >
      <div ref={maskRef} aria-hidden className="vi-mask pointer-events-none absolute inset-0 z-0">
        {/* Le filtre est posé en style inline plutôt qu'en classes : GSAP anime
            `filter` sur ce même élément, et il lui faut une valeur de départ
            qu'il puisse interpoler. */}
        <div ref={mapRef} className="absolute inset-0" style={{ filter: "brightness(0.55) saturate(0.8) contrast(1.08)" }}>
          <Image src="/brand/map-hero.jpg" alt="" fill priority sizes="100vw" className="object-cover object-center" />
        </div>
      </div>

      {/* Voile sombre au centre, transparent sur les bords : le wordmark occupe
          le centre et réclame un fond calme, la carte doit rester lisible autour. */}
      <div
        ref={scrimRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_52%_48%_at_50%_46%,rgba(17,17,23,0.78)_0%,rgba(17,17,23,0.5)_45%,rgba(17,17,23,0.16)_75%,rgba(17,17,23,0)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-72 bg-gradient-to-b from-transparent via-background/70 to-background"
      />

      <div className="relative z-10 flex flex-col items-center">
        <p className="hero-stagger vi-kicker mb-5 text-accent-pale [text-shadow:0_1px_10px_rgba(0,0,0,0.7)]">
          Carte interactive non officielle
        </p>

        <div className="hero-stagger w-full max-w-[min(560px,80vw)]">
          <Image
            src="/brand/gta-vi-logo.svg"
            alt="Grand Theft Auto VI"
            width={980}
            height={744}
            unoptimized
            priority
            className="mx-auto h-[clamp(150px,30svh,330px)] w-auto max-w-full drop-shadow-[0_18px_60px_rgba(249,118,176,0.45)]"
          />
        </div>

        <h1 className="hero-stagger vi-display mt-6 text-center text-[clamp(2rem,6vw,4.25rem)]">
          <span className="text-gradient-vi">Leonida</span>
        </h1>

        <p className="hero-stagger mt-4 max-w-xl text-center text-sm leading-relaxed text-white/80 [text-shadow:0_1px_12px_rgba(0,0,0,0.75)] sm:text-base">
          {locationCount.toLocaleString("fr-FR")} lieux répertoriés sur {regionCount} régions, les plans des trailers
          géolocalisés au mètre près, et votre progression sauvegardée.
        </p>

        <div className="hero-stagger mt-7 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/map"
            className="group inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-sm font-semibold text-background transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <MapPin className="h-4 w-4" />
            Explorer la carte
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <a
            href="#trailers"
            className="rs-pill inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-foreground backdrop-blur-sm"
          >
            Voir les trailers
          </a>
        </div>
      </div>

      <a
        href="#chiffres"
        aria-label="Faire défiler vers le contenu"
        className="hero-stagger absolute bottom-8 z-10 grid h-10 w-10 place-items-center rounded-full border border-border bg-background/40 text-muted backdrop-blur transition-colors hover:border-border-strong hover:text-foreground"
      >
        <ChevronDown className="h-4 w-4 animate-bounce" />
      </a>
    </section>
  );
}
