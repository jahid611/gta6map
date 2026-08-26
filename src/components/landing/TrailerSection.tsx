"use client";

import { useState } from "react";
import Image from "next/image";
import { Camera } from "@/components/ui/icons";

interface Trailer {
  /** Identifiant de la vidéo sur la chaîne officielle Rockstar Games. */
  id: string;
  title: string;
  date: string;
  blurb: string;
  /** Affiche : une frame du trailer, déjà servie par `public/frames`. */
  poster: string;
}

/**
 * Les deux trailers officiels, lus sur place.
 *
 * Identifiants vérifiés via l'API oEmbed de YouTube : les deux sont bien publiés
 * par la chaîne « Rockstar Games ». Plusieurs réuploads de fans circulent sous
 * des titres quasi identiques — ne pas les substituer sans revérifier l'auteur.
 *
 * L'iframe n'est montée qu'au clic, pour trois raisons : la page ne charge pas
 * ~1 Mo de lecteur YouTube que personne n'a demandé, aucun cookie ni requête
 * vers Google n'est émis tant que l'utilisateur n'a rien lancé, et l'affiche
 * (une frame déjà présente dans nos assets) s'affiche instantanément.
 * `youtube-nocookie.com` limite le pistage une fois la lecture lancée.
 */
const TRAILERS: readonly Trailer[] = [
  {
    id: "QdBZY2fkU-0",
    title: "Trailer 1",
    date: "Décembre 2023",
    blurb: "Le retour à Vice City. Lucia, Jason, et un État de Leonida filmé comme un fait divers.",
    poster: "/frames/t1-10-beach.jpg",
  },
  {
    id: "VQRLujxTm3c",
    title: "Trailer 2",
    date: "Mai 2025",
    blurb: "Les Keys, les marécages, les néons. Le second regard officiel sur Leonida.",
    poster: "/frames/t2-1-key-lento.jpg",
  },
];

export function TrailerSection() {
  const [playing, setPlaying] = useState<string | null>(null);

  return (
    <section id="trailers" className="relative scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="vi-reveal mx-auto max-w-2xl text-center">
          <p className="vi-kicker text-accent">Les trailers officiels</p>
          <h2 className="vi-display mt-5 text-[clamp(2rem,5.5vw,3.75rem)]">
            Tout est parti
            <br />
            de ces deux vidéos
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted">
            Les 59 plans replacés sur la carte viennent d&apos;ici. Regardez-les sans quitter la page.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {TRAILERS.map((trailer) => (
            <article key={trailer.id} className="vi-reveal">
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-black">
                {playing === trailer.id ? (
                  <iframe
                    // `autoplay` est légitime ici : la lecture répond à un clic.
                    src={`https://www.youtube-nocookie.com/embed/${trailer.id}?autoplay=1&rel=0`}
                    title={`GTA VI — ${trailer.title}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                  />
                ) : (
                  <button
                    onClick={() => setPlaying(trailer.id)}
                    className="group absolute inset-0 h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    aria-label={`Lire le ${trailer.title} de GTA VI`}
                  >
                    <Image
                      src={trailer.poster}
                      alt=""
                      fill
                      quality={88}
                      // Affiche de trailer : même sur-échantillonnage que les portraits, c est
                      // le visuel qui porte la section.
                      sizes="(max-width: 1024px) 100vw, 1024px"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <span aria-hidden className="absolute inset-0 bg-black/35 transition-colors group-hover:bg-black/25" />

                    <span
                      aria-hidden
                      className="absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/95 shadow-[0_12px_45px_rgba(0,0,0,0.55)] transition-transform duration-300 group-hover:scale-110"
                    >
                      {/* Triangle CSS : un glyphe « play » de la fonte d'icônes serait
                          optiquement décentré dans un rond de cette taille. */}
                      <span className="ml-1.5 h-0 w-0 border-y-[13px] border-l-[21px] border-y-transparent border-l-[#0f0617]" />
                    </span>

                    <span className="absolute inset-x-5 bottom-5 text-left">
                      <span className="vi-kicker block text-white/70">{trailer.date}</span>
                      <span className="vi-display mt-1 block text-2xl text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.8)]">
                        {trailer.title}
                      </span>
                    </span>
                  </button>
                )}
              </div>

              <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-muted">
                <Camera className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {trailer.blurb}
              </p>
            </article>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-2">
          Vidéos hébergées par YouTube sur la chaîne officielle Rockstar Games. Aucune requête n&apos;est envoyée
          avant que vous ne lanciez la lecture.
        </p>
      </div>
    </section>
  );
}
