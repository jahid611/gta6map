"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Category, Location } from "@/types";
import { pastel } from "@/lib/colors";
import { CategoryIcon, Compass, Copy, Check, ExternalLink, LocateFixed, MapPin, Maximize2, Mountain, X } from "@/components/ui/icons";

export interface PageImage {
  src: string;
  label: string;
}

interface Props {
  location: Location;
  category: Category | undefined;
  images: PageImage[];
  nearby: { slug: string; name: string; distance: number; color: string; icon: string }[];
  /** Texte de présentation, rédigé côté serveur pour rester indexable. */
  summary: string;
  /** Illustration décorative quand le lieu n'a aucune image propre. */
  fallbackHero: string | null;
  /** Quartier du mode piéton où ce lieu se visite à pied, s'il y en a un. */
  streetZone: string | null;
}

/**
 * Corps interactif de la page dédiée : visionneuse, copie des coordonnées.
 *
 * Séparé de la page elle-même, qui reste un composant serveur — c'est elle qui
 * porte le rendu statique, le JSON-LD et les métadonnées indexables. Seul ce
 * qui réclame de l'interaction bascule côté client.
 */
export function LocationPageBody({
  location,
  category,
  images,
  nearby,
  summary,
  fallbackHero,
  streetZone,
}: Props) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const accent = pastel(category?.color ?? location.color);
  const hero = images[0];
  const rest = images.slice(1);

  const copyCoords = async () => {
    try {
      await navigator.clipboard.writeText(`${location.x}, ${location.y}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papiers indisponible */
    }
  };

  const facts = [
    { icon: LocateFixed, label: "Coordonnées monde", value: `${location.x}, ${location.y}`, mono: true },
    location.z !== null ? { icon: Mountain, label: "Altitude", value: `${location.z} m`, mono: true } : null,
    location.area ? { icon: MapPin, label: "Zone", value: location.area, mono: false } : null,
    location.media
      ? { icon: Compass, label: "Cap caméra", value: `${Math.round(location.media.yaw)}°`, mono: true }
      : null,
  ].filter((f): f is { icon: typeof MapPin; label: string; value: string; mono: boolean } => f !== null);

  return (
    <>
      {/* En-tête illustré : l'image porte le titre plutôt que de le précéder,
          ce qui donne à la page une entrée en matière au lieu d'une liste. */}
      <header className="relative isolate overflow-hidden">
        {hero ? (
          <>
            {/* Vraie photo du lieu : affichée telle quelle. Seul un dégradé bas,
                cantonné au tiers inférieur, assoit le titre — le reste de
                l'image garde ses couleurs d'origine. */}
            <Image src={hero.src} alt="" fill priority sizes="100vw" className="object-cover object-center" />
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/70 to-transparent"
            />
          </>
        ) : fallbackHero ? (
          <>
            {/* Illustration de repli : ce n'est PAS une photo de ce lieu. Elle est
                donc nettement assombrie et floutée — elle sert de fond, pas de
                document. La montrer nette laisserait croire qu'elle le représente. */}
            <Image
              src={fallbackHero}
              alt=""
              fill
              priority
              sizes="100vw"
              className="scale-105 object-cover object-center opacity-45 blur-[2px]"
            />
            <div aria-hidden className="absolute inset-0 bg-background/45" />
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background to-transparent"
            />
          </>
        ) : (
          <div aria-hidden className="absolute inset-0 bg-surface-2" />
        )}

        <div className="relative mx-auto flex min-h-[46svh] max-w-4xl flex-col justify-end px-5 pb-10 pt-32">
          <div className="flex items-start gap-4">
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[#14111c] shadow-[0_2px_16px_rgba(0,0,0,0.4)]"
              style={{ background: accent }}
            >
              <CategoryIcon name={category?.icon ?? (location.kind === "camera" ? "Camera" : "MapPin")} className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="vi-kicker" style={{ color: accent }}>
                {category?.name ?? "Lieu"}
              </p>
              <h1 className="vi-display mt-2 text-[clamp(1.75rem,5vw,3.25rem)]">{location.name}</h1>
              {location.area && <p className="mt-2 text-sm text-muted">{location.area}</p>}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 pb-20">
        {/* Faits saillants, en grille plutôt qu'en phrase : on vient souvent
            chercher une seule de ces valeurs. */}
        <ul className="vi-reveal -mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {facts.map(({ icon: Icon, label, value, mono }) => (
            <li key={label} className="rs-card rounded-2xl p-3">
              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-2">
                <Icon className="h-3 w-3" />
                {label}
              </span>
              <span className={`mt-1.5 block truncate text-sm text-foreground ${mono ? "vi-num" : "font-medium"}`}>
                {value}
              </span>
            </li>
          ))}
        </ul>

        <div className="vi-reveal mt-4 flex flex-wrap gap-2">
          <Link
            href={`/map?l=${location.slug}`}
            className="rs-pill rs-pill--accent inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
          >
            <MapPin className="h-4 w-4" />
            Ouvrir sur la carte
          </Link>
          {streetZone && (
            <Link
              href={`/street?zone=${streetZone}&l=${location.slug}`}
              className="rs-pill inline-flex items-center gap-2 px-4 py-2.5 text-sm"
            >
              <Compass className="h-4 w-4 text-accent-2" />
              Marcher ici
            </Link>
          )}
          <button onClick={copyCoords} className="rs-pill inline-flex items-center gap-2 px-4 py-2.5 text-sm">
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copié" : "Coordonnées"}
          </button>
          {location.wiki && (
            <a
              href={location.wiki.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rs-pill inline-flex items-center gap-2 px-4 py-2.5 text-sm"
            >
              GTA Wiki <ExternalLink className="h-3 w-3 text-muted" />
            </a>
          )}
        </div>

        <section className="vi-reveal mt-10 max-w-2xl text-[15px] leading-relaxed text-muted">
          <p>{summary}</p>
        </section>

        {rest.length > 0 && (
          <section className="mt-12">
            <h2 className="vi-kicker text-accent">Images</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {rest.map((img, i) => (
                <button
                  key={img.src}
                  onClick={() => setLightbox(i + 1)}
                  className="vi-reveal group relative aspect-video overflow-hidden rounded-2xl border border-border bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  data-reveal-delay={(i % 2) * 0.08}
                  aria-label={`Agrandir : ${img.label}`}
                >
                  <Image
                    src={img.src}
                    alt={`${location.name} — ${img.label}`}
                    fill
                    sizes="(max-width: 640px) 100vw, 32rem"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span
                    aria-hidden
                    className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </span>
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-8 text-left text-xs text-white">
                    {img.label}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {nearby.length > 0 && (
          <section className="mt-12">
            <h2 className="vi-kicker text-accent">À proximité</h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {nearby.map((n, i) => (
                <li key={n.slug} className="vi-reveal" data-reveal-delay={(i % 2) * 0.06}>
                  <Link
                    href={`/location/${n.slug}`}
                    className="rs-card flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:border-accent/40"
                  >
                    <CategoryIcon name={n.icon} className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{n.name}</span>
                    <span className="vi-num shrink-0 text-xs text-muted-2">{Math.round(n.distance)} m</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {lightbox !== null && images[lightbox] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={images[lightbox].label}
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[1400] grid place-items-center bg-[#07060d]/96 p-4"
        >
          <button
            onClick={() => setLightbox(null)}
            aria-label="Fermer"
            className="rs-pill absolute right-4 top-4 grid h-10 w-10 place-items-center"
          >
            <X className="h-4 w-4" />
          </button>
          <Image
            src={images[lightbox].src}
            alt={images[lightbox].label}
            width={1600}
            height={900}
            quality={88}
            sizes="(max-width: 1600px) 100vw, 1600px"
            className="max-h-[85vh] w-auto rounded-xl object-contain"
          />
        </div>
      )}
    </>
  );
}
