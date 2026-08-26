"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export interface CharacterSectionProps {
  name: string;
  /** Accroche courte, en gros au-dessus du texte. */
  tagline: string;
  bio: string;
  /** Trois visuels : le premier en pleine hauteur, les deux autres en colonne. */
  images: readonly [string, string, string];
  /** Colonne de texte à droite plutôt qu'à gauche — on alterne d'un personnage à l'autre. */
  reverse?: boolean;
  /** Clip officiel du personnage. Remplace le visuel fixe de la colonne texte. */
  clip?: string | null;
}

/**
 * Portrait d'un personnage : texte d'un côté, pile d'images de l'autre, la pile
 * remontant plus vite que la page au défilement.
 *
 * L'écart de vitesse entre les deux colonnes est tout l'effet : le texte suit le
 * scroll, les images le devancent, et la section se recompose pendant qu'on la
 * traverse. `scrub` relie l'animation à la position de scroll plutôt qu'à une
 * durée, pour qu'elle se joue aussi à rebours quand on remonte.
 */
export function CharacterSection({ name, tagline, bio, images, reverse = false, clip = null }: CharacterSectionProps) {
  const rootRef = useRef<HTMLElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const soloRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Le clip ne se charge et ne joue que lorsqu'il est visible : sur une page qui
  // en compte plusieurs, tout précharger coûterait des dizaines de mégaoctets
  // pour des vidéos que l'on n'atteindra peut-être jamais.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // React ne sérialise pas l'attribut `muted` dans le HTML rendu côté serveur.
    // Le navigateur recevait donc une vidéo considérée comme sonore, refusait la
    // lecture automatique, et le `play()` rejeté était avalé par le `catch` : le
    // clip restait indéfiniment sur son affiche (readyState 0). On rétablit
    // l'état muet impérativement, avant toute tentative de lecture.
    video.muted = true;
    video.defaultMuted = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          video.pause();
          return;
        }
        // `preload="metadata"` ne télécharge que l'en-tête : la première image
        // arrive vite, le corps du fichier n'est demandé qu'ici.
        if (video.readyState === 0) video.load();
        void video.play().catch(() => {});
      },
      { threshold: 0.2 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, [clip]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Sous `lg`, les colonnes s'empilent : décaler l'une par rapport à l'autre
    // n'aurait plus de sens et creuserait juste un trou dans la page.
    if (!window.matchMedia("(min-width: 1024px)").matches) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // Amplitude volontairement modérée : au-delà d'une centaine de pixels, la
      // pile sort de sa boîte et laisse un vide en fin de section qui se lit
      // comme un bug de mise en page plutôt que comme un effet.
      const st = { trigger: rootRef.current, start: "top bottom", end: "bottom top", scrub: 1.2 };
      gsap.fromTo(stackRef.current, { y: 70 }, { y: -70, ease: "none", scrollTrigger: st });
      gsap.fromTo(soloRef.current, { y: 26 }, { y: -26, ease: "none", scrollTrigger: st });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={rootRef} className="relative overflow-hidden py-24 sm:py-32">
      <div
        className={`mx-auto flex max-w-6xl flex-col gap-12 px-5 lg:items-center lg:gap-16 ${
          reverse ? "lg:flex-row-reverse" : "lg:flex-row"
        }`}
      >
        <div className="vi-reveal max-w-xl lg:w-[46%] lg:shrink-0">
          <h2 className="vi-display text-[clamp(2.25rem,6vw,4.5rem)] text-gradient-vi">{name}</h2>
          <p className="mt-6 text-xl font-semibold leading-snug text-accent-pale sm:text-2xl">{tagline}</p>
          <p className="mt-5 text-base leading-relaxed text-muted">{bio}</p>

          <div ref={soloRef} className="mt-10 overflow-hidden rounded-2xl border border-border">
            {clip ? (
              // Le clip officiel remplace le visuel fixe quand il existe.
              // `preload="none"` : le fichier ne part sur le réseau que lorsque
              // la section entre à l'écran (cf. l'observateur ci-dessus), pas au
              // chargement de la page.
              <video
                ref={videoRef}
                src={clip}
                muted
                loop
                playsInline
                preload="metadata"
                poster={images[2]}
                className="aspect-video h-full w-full object-cover"
              />
            ) : (
              // Dimensions intrinsèques réelles (3840 × 2160) : c'est ce qui permet
              // à next/image de générer les tailles utiles.
              <Image
                src={images[2]}
                alt=""
                width={3840}
                height={2160}
                quality={92}
                sizes="(max-width: 1024px) 100vw, 34rem"
                className="aspect-video h-full w-full object-cover transition-transform duration-700 hover:scale-[1.03]"
              />
            )}
          </div>
        </div>

        <div ref={stackRef} className="flex flex-col gap-5 lg:w-[54%]">
          {[images[0], images[1]].map((src, i) => (
            <div key={src} className="overflow-hidden rounded-2xl border border-border">
              <Image
                src={src}
                alt=""
                width={3840}
                height={2160}
                quality={92}
                sizes="(max-width: 1024px) 100vw, 40rem"
                className={`h-full w-full object-cover transition-transform duration-700 hover:scale-[1.03] ${
                  i === 0 ? "aspect-[4/3]" : "aspect-video"
                }`}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
