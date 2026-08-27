"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Compass,
  Copy,
  Database,
  ExternalLink,
  Link2,
  LocateFixed,
  MapPin,
  Maximize2,
  Mountain,
  Ruler,
} from "@/components/ui/icons";
import type { Category, Location, LocationWiki } from "@/types";
import { frameUrl, photoUrl, wikiImageUrl } from "@/lib/media";
import { FLAG_LABELS } from "@/lib/data/categories";
import { useProgressStore } from "@/store/useProgressStore";
import { useMapStore } from "@/store/useMapStore";
import { useUIStore } from "@/store/useUIStore";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import dynamic from "next/dynamic";

// Chargée à la demande : le cadre Google Maps n'est monté que si l'utilisateur
// déplie la vue réelle, et n'apparaît donc dans aucun autre parcours.
const RealWorldMap = dynamic(() => import("./RealWorldMap").then((m) => m.RealWorldMap), {
  ssr: false,
  // Même hauteur que la carte repliée : sinon la fiche sursaute au montage.
  loading: () => <div className="h-24 w-full animate-pulse rounded-2xl border border-border bg-surface-3" />,
});
import { Lightbox, type LightboxImage } from "@/components/ui/lightbox";
import { cn } from "@/lib/utils";
import { pastel } from "@/lib/colors";
import { CategoryIcon } from "@/components/ui/icons";

interface LocationDetailsProps {
  location: Location;
  category: Category | undefined;
  /** Fiche wiki de la zone (résolue côté client ; sinon `location.areaWiki`). */
  areaWiki?: LocationWiki | null;
}

const STATUS_LABEL = {
  confirmed: { label: "Confirmé", variant: "success" as const },
  unconfirmed: { label: "Non confirmé", variant: "warning" as const },
  unknown: { label: "Inconnu", variant: "outline" as const },
};

/** Fiche lieu — mise en page inspirée des cartes « State of Leonida » : image hero, infos, tags, actions, Full View. */
export function LocationDetails({ location, category, areaWiki: areaWikiProp = null }: LocationDetailsProps) {
  const areaWiki = areaWikiProp ?? location.areaWiki;
  const found = useProgressStore((s) => s.entries[location.id]?.found ?? false);
  const note = useProgressStore((s) => s.entries[location.id]?.note ?? "");
  const setFound = useProgressStore((s) => s.setFound);
  const setNote = useProgressStore((s) => s.setNote);
  const flyTo = useMapStore((s) => s.flyTo);
  const [copied, setCopied] = useState<"coords" | "link" | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  // `/map?share=1` : l'utilisateur vient du chat pour choisir un lieu à partager.
  const shareMode = useSearchParams().get("share") === "1";
  const openRealWorldAt = useMapStore((s) => s.openRealWorldAt);
  const openRealWorldFromGame = useMapStore((s) => s.openRealWorldFromGame);
  const selectLocation = useUIStore((s) => s.selectLocation);
  const isDesktop = useIsDesktop();
  const realWorld = useMapStore((s) => s.realWorld);
  const toggleRealWorld = useMapStore((s) => s.toggleRealWorld);
  const hasRealCoords = location.realWorld.lat !== null && location.realWorld.lng !== null;

  const images = useMemo<LightboxImage[]>(() => {
    const list: LightboxImage[] = [];
    const frame = frameUrl(location.media?.frame);
    if (frame && location.media) {
      list.push({
        src: frame,
        alt: `${location.name} — ${location.media.sourceLabel}`,
        caption: `${location.media.sourceLabel}${location.media.frameIndex !== null ? ` · plan ${location.media.frameIndex}` : ""} — © Rockstar Games`,
      });
    }
    const ig = photoUrl(location.photos.ig);
    if (ig) list.push({ src: ig, alt: `${location.name} — in-game`, caption: "Capture in-game — © Rockstar Games / gtadb.org" });
    const wikiImg = wikiImageUrl(location.wiki);
    if (wikiImg && location.wiki) {
      list.push({ src: wikiImg, alt: `${location.wiki.title} — GTA Wiki`, caption: "GTA Wiki (CC BY-NC-SA)", href: location.wiki.url, hrefLabel: "gta.wiki" });
    }
    const irl = photoUrl(location.photos.irl);
    if (irl) list.push({ src: irl, alt: `${location.realWorld.name ?? location.name} — lieu réel`, caption: `Lieu réel${location.realWorld.name ? ` : ${location.realWorld.name}` : ""}` });
    return list;
  }, [location]);

  const hero = images[0] ?? null;
  const thumbs = images.slice(1);
  const areaWikiImage = wikiImageUrl(areaWiki);
  const nameStatus = STATUS_LABEL[location.nameStatus];
  const irlStatus = STATUS_LABEL[location.realWorld.status];
  const isCamera = location.kind === "camera";
  // Même teinte pastel que les marqueurs et la légende du panneau latéral :
  // la couleur doit être exactement la même d'un bout à l'autre, sinon elle
  // cesse de servir de repère entre la carte et la fiche.
  const accent = pastel(category?.color ?? location.color);


  const copy = async (kind: "coords" | "link") => {
    const text = kind === "coords" ? `${location.x}, ${location.y}` : `${window.location.origin}/?l=${location.slug}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard indisponible */
    }
  };

  return (
    <div className="flex flex-col">
      {/* Hero */}
      {hero ? (
        <button
          className="group relative block aspect-[16/9] w-full overflow-hidden bg-surface-2 cursor-pointer"
          onClick={() => setLightbox(0)}
          aria-label="Ouvrir en plein écran"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero.src} alt={hero.alt} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background/90 to-transparent" />
          <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
            <Maximize2 className="h-4 w-4" />
          </span>
          {location.media && (
            <span
              className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#14111c]"
              style={{ background: accent }}
            >
              {location.media.sourceLabel}
              {location.media.frameIndex !== null ? ` · ${location.media.frameIndex}` : ""}
            </span>
          )}
        </button>
      ) : (
        <div className="h-2 w-full" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      )}

      <div className="flex flex-col gap-4 p-4">
        {/* Titre */}
        <div className="flex items-start gap-3 pr-8">
          {/* Aplat pastel : le glyphe doit donc être sombre, comme sur les blips
              de la carte (cf. `.gta-marker__pin`). */}
          <span
            className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#14111c] shadow-[0_2px_14px_rgba(0,0,0,0.35)]"
            style={{ background: accent }}
          >
            {/* Icône de la catégorie, et non un marqueur générique : le même
                pictogramme que sur la carte et dans la liste des filtres. */}
            <CategoryIcon name={category?.icon ?? (isCamera ? "Camera" : "MapPin")} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-extrabold leading-tight tracking-tight">{location.name}</h2>
            <p className="mt-0.5 text-sm text-muted">
              {category?.name ?? "Lieu"}
              {location.area ? ` · ${location.area}` : ""}
            </p>
          </div>
        </div>

        {/* Vignettes secondaires */}
        {thumbs.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {thumbs.map((img, i) => (
              <button
                key={img.src}
                className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-surface-2 cursor-pointer"
                onClick={() => setLightbox(i + 1)}
                aria-label={img.alt}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src} alt={img.alt} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
              </button>
            ))}
          </div>
        )}

        {/* Description */}
        {location.description && <p className="text-sm leading-relaxed text-foreground/85">{location.description}</p>}

        {/* Infos façon liste iconée */}
        <ul className="flex flex-col gap-1.5 text-sm">
          <li className="flex items-center gap-2">
            <LocateFixed className="h-4 w-4 shrink-0 text-muted" />
            <span className="vi-num text-xs">{location.x}, {location.y}</span>
            {/* Les deux copies tiennent en deux icônes, à côté de la valeur qu'elles
                copient. Les boutons pleine largeur qui les doublaient plus bas ont
                été retirés : deux lignes pour la même action. */}
            <button className="text-muted hover:text-foreground cursor-pointer" onClick={() => copy("coords")} aria-label="Copier les coordonnées">
              {copied === "coords" ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button className="text-muted hover:text-foreground cursor-pointer" onClick={() => copy("link")} aria-label="Copier le lien vers ce lieu">
              {copied === "link" ? <Check className="h-3.5 w-3.5 text-success" /> : <Link2 className="h-3.5 w-3.5" />}
            </button>
          </li>
          {location.area && (
            <li className="flex items-center gap-2">
              <Database className="h-4 w-4 shrink-0 text-muted" />
              <span>{location.area}</span>
            </li>
          )}
          {location.z !== null && (
            <li className="flex items-center gap-2">
              <Mountain className="h-4 w-4 shrink-0 text-muted" />
              <span className="vi-num text-xs">altitude {location.z} m</span>
              {location.height !== null && (
                <>
                  <Ruler className="ml-2 h-4 w-4 shrink-0 text-muted" />
                  <span className="vi-num text-xs">≈ {Math.round(location.height)} m</span>
                </>
              )}
            </li>
          )}
          {location.media && (
            <li className="flex items-center gap-2">
              <Compass className="h-4 w-4 shrink-0 text-muted" />
              <span className="vi-num text-xs">
                cap {Math.round(location.media.yaw)}° · {location.media.hfov ? `FOV ${Math.round(location.media.hfov)}°` : `${location.media.width}×${location.media.height}`}
              </span>
            </li>
          )}
        </ul>

        {/* Tags pills */}
        <div className="flex flex-wrap gap-1.5">
          {!isCamera && <Badge variant={nameStatus.variant}>Nom {nameStatus.label.toLowerCase()}</Badge>}
          {location.flags.map((f) => (
            <Badge key={f} variant="warning">
              {FLAG_LABELS[f] ?? f}
            </Badge>
          ))}
          {location.tags
            .filter((t) => !location.flags.includes(t))
            .map((t) => (
              <Badge key={t} variant="outline" className="uppercase tracking-wide">
                {t}
              </Badge>
            ))}
        </div>

        {/* Actions */}
        {!isCamera && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant={found ? "success" : "default"} onClick={() => setFound(location.id, !found)} aria-pressed={found}>
              <Check className="h-4 w-4" />
              {found ? "Trouvé" : "Marquer trouvé"}
            </Button>
            {/* « Centrer » agit sur la carte affichée : sur la vue réelle,
                `flyTo` piloterait la carte du jeu, cachée derrière — le bouton
                semblait alors ne rien faire. */}
            <Button
              variant="secondary"
              onClick={() =>
                realWorld && hasRealCoords
                  ? openRealWorldAt(location.realWorld.lat as number, location.realWorld.lng as number, 17)
                  : flyTo([location.x, location.y], 6)
              }
            >
              <LocateFixed className="h-4 w-4" />
              Centrer
            </Button>
          </div>
        )}
        {location.wiki && (
          <a
            href={location.wiki.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rs-pill flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold"
          >
            <BookOpen className="h-4 w-4 text-accent-2" /> GTA Wiki <ExternalLink className="h-3 w-3 text-muted" />
          </a>
        )}
        {isCamera && (
          <Button variant="secondary" onClick={() => flyTo([location.x, location.y], 6)}>
            <LocateFixed className="h-4 w-4" /> Centrer la caméra
          </Button>
        )}
        {/* Partage dans le chat communautaire : ramène sur /community avec ce lieu prêt à envoyer.
            Mis en avant (rose) quand on vient du chat en mode partage (`/map?share=1`). */}
        <Link
          href={`/community?share=${location.slug}`}
          className={cn(
            "flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors",
            shareMode ? "bg-accent text-white shadow-[0_0_24px_rgba(249,118,176,0.4)] hover:bg-accent-deep" : "rs-pill",
          )}
        >
          <MapPin className="h-4 w-4" /> {shareMode ? "Partager ce lieu" : "Partager dans le chat"}
        </Link>
        {/* Pas de bouton « Full View » : l'image d'en-tête est déjà cliquable et
            porte une icône d'agrandissement au survol. Un bouton pleine largeur
            de plus ne faisait que répéter ce geste. */}

        {/* Zone / quartier (fiche GTA Wiki) */}
        {areaWiki && (
          <a
            href={areaWiki.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative block overflow-hidden rounded-2xl border border-border bg-surface-2"
          >
            {areaWikiImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={areaWikiImage}
                alt={areaWiki.title}
                className="h-28 w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                loading="lazy"
              />
            )}
            <div className="p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Zone · GTA Wiki</p>
              <p className="font-display text-base font-bold">{areaWiki.title.replace(/\s*\((HD Universe|town)\)$/, "")}</p>
              {areaWiki.extract && <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted">{areaWiki.extract}</p>}
              <span className="mt-2 inline-flex items-center gap-1 text-xs text-accent-2">
                Lire la fiche <ExternalLink className="h-3 w-3" />
              </span>
            </div>
          </a>
        )}

        {/* Bascule vers le monde réel — proposée sur TOUS les lieux : ils
            existent tous quelque part sur Terre, même ceux dont la
            correspondance exacte n'a pas encore été relevée. Coordonnées
            précises quand la fiche en porte, sinon position transposée depuis
            les lieux voisins, ce que le bandeau de la carte annonce. */}
        <button
          onClick={() => {
            // Au doigt, la fiche occupe l'écran : la refermer laisse voir la
            // carte vers laquelle on vient d'envoyer l'utilisateur.
            if (!isDesktop) selectLocation(null);
            if (realWorld) {
              // Déjà dans le monde réel : le bouton fait le trajet inverse et
              // ramène à la position de jeu exacte du lieu.
              flyTo([location.x, location.y], 7);
              toggleRealWorld();
            } else if (hasRealCoords) {
              openRealWorldAt(location.realWorld.lat as number, location.realWorld.lng as number, 17);
            } else {
              openRealWorldFromGame(location.x, location.y);
            }
          }}
          className="rs-pill rs-pill--accent inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold"
        >
          {realWorld ? <MapPin className="h-4 w-4" /> : <Compass className="h-4 w-4" />}
          {realWorld ? "Voir dans GTA VI" : "Voir dans la vraie vie"}
          {!realWorld && !hasRealCoords && <span className="text-[11px] font-normal opacity-70">· approx.</span>}
        </button>

        {/* Monde réel */}
        {location.realWorld.status !== "unknown" && location.realWorld.name && (
          <section className="rounded-2xl border border-border bg-surface-2/60 p-3">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Équivalent réel</h3>
              <Badge variant={irlStatus.variant}>{irlStatus.label}</Badge>
            </div>
            <p className="text-sm font-medium">{location.realWorld.name}</p>
            {location.realWorld.address && <p className="text-xs text-muted">{location.realWorld.address}</p>}
            {location.realWorld.lat !== null && location.realWorld.lng !== null && (
              <>
                {/* La carte porte désormais tout : l'aperçu, les coordonnées et
                    le lien vers Google Maps. Le bouton et le lien qui la
                    précédaient faisaient trois commandes pour une seule action. */}
                <div className="mt-2">
                  <RealWorldMap
                    lat={location.realWorld.lat}
                    lng={location.realWorld.lng}
                    label={location.realWorld.name ?? location.name}
                    // Même pastille que le blip sur la carte du jeu : la couleur
                    // sert de repère d'un bout à l'autre de l'app.
                    color={accent}
                    icon={category?.icon ?? (isCamera ? "Camera" : "MapPin")}
                  />
                </div>
              </>
            )}
          </section>
        )}

        {/* Note perso */}
        {!isCamera && (
          <section>
            <label htmlFor={`note-${location.id}`} className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
              Ma note
            </label>
            <textarea
              id={`note-${location.id}`}
              defaultValue={note}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (note ?? "")) setNote(location.id, v || null);
              }}
              placeholder="Ajouter une note personnelle…"
              rows={2}
              className={cn(
                "w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2",
              )}
            />
          </section>
        )}

        <div className="flex items-center gap-2 text-xs text-muted">
          <Link href={`/location/${location.slug}`} className="inline-flex items-center gap-1 hover:text-foreground">
            Page dédiée <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <span className="ml-auto vi-num text-[10px] text-muted-2">
            {location.legacyId} · {location.source}
          </span>
        </div>
      </div>

      <Lightbox images={images} index={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
