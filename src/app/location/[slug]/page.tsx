import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Compass, ExternalLink, MapPin } from "lucide-react";
import { getCategories, getLocationBySlug, getLocations, getStaticLocationSlugs } from "@/lib/data/locations";
import { FRAMES_BASE_URL, PHOTOS_BASE_URL, WIKI_IMAGES_BASE_URL } from "@/lib/map/config";
import { SITE_NAME, SITE_URL } from "@/app/layout";

export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  return getStaticLocationSlugs().map((slug) => ({ slug }));
}

function assetUrl(base: string, file: string | null | undefined): string | null {
  if (!file) return null;
  return /^https?:\/\//.test(file) ? file : `${base}/${file}`;
}

export async function generateMetadata({ params }: PageProps<"/location/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const location = await getLocationBySlug(slug);
  if (!location) return { title: "Lieu introuvable" };
  const title = `${location.name}${location.area ? ` — ${location.area}` : ""}`;
  const description =
    location.kind === "camera"
      ? `${location.name} : plan du ${location.media?.sourceLabel ?? "trailer"} GTA VI géolocalisé en ${location.x}, ${location.y} (position caméra triangulée).`
      : `${location.name} sur la carte GTA VI : coordonnées ${location.x}, ${location.y}${
          location.realWorld.name ? `, inspiré de ${location.realWorld.name}` : ""
        }. Photos, fiche wiki et suivi de complétion.`;
  const image =
    assetUrl(FRAMES_BASE_URL, location.media?.frame) ??
    assetUrl(PHOTOS_BASE_URL, location.photos.ig) ??
    assetUrl(WIKI_IMAGES_BASE_URL, location.wiki?.image);
  return {
    title,
    description,
    alternates: { canonical: `/location/${location.slug}` },
    openGraph: { title, description, type: "article", images: image ? [{ url: image }] : undefined },
  };
}

/** Page SEO statique par lieu (SSG + ISR) : contenu indexable, JSON-LD, lien profond vers la carte. */
export default async function LocationPage({ params }: PageProps<"/location/[slug]">) {
  const { slug } = await params;
  const location = await getLocationBySlug(slug);
  if (!location) notFound();

  const [categories, all] = await Promise.all([getCategories(), getLocations()]);
  const category = categories.find((c) => c.slug === location.categorySlug);
  const nearby = all
    .filter((l) => l.id !== location.id)
    .map((l) => ({ l, d: Math.hypot(l.x - location.x, l.y - location.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 6);

  const images = [
    { src: assetUrl(FRAMES_BASE_URL, location.media?.frame), label: location.media ? `${location.media.sourceLabel} — © Rockstar Games` : "" },
    { src: assetUrl(PHOTOS_BASE_URL, location.photos.ig), label: "Capture in-game" },
    { src: assetUrl(WIKI_IMAGES_BASE_URL, location.wiki?.image), label: "GTA Wiki" },
    { src: assetUrl(PHOTOS_BASE_URL, location.photos.irl), label: "Lieu réel" },
  ].filter((i): i is { src: string; label: string } => !!i.src);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": location.kind === "camera" ? "ImageObject" : "Place",
    name: location.name,
    url: `${SITE_URL}/location/${location.slug}`,
    description: location.description ?? `${location.name} — ${category?.name ?? "lieu"} dans GTA VI.`,
    image: images[0]?.src,
    containedInPlace: location.area ? { "@type": "Place", name: location.area } : undefined,
    sameAs: location.wiki?.url,
    additionalProperty: [
      { "@type": "PropertyValue", name: "x", value: location.x, unitText: "m" },
      { "@type": "PropertyValue", name: "y", value: location.y, unitText: "m" },
    ],
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="mb-6 text-sm text-muted">
        <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour à la carte
        </Link>
      </nav>

      <header className="mb-6 flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: category?.color ?? location.color }}>
          {location.kind === "camera" ? <Compass className="h-6 w-6" /> : <MapPin className="h-6 w-6" />}
        </span>
        <div>
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight">{location.name}</h1>
          <p className="mt-1 text-muted">
            {category?.name}
            {location.area ? ` · ${location.area}` : ""} · <span className="font-mono text-sm">{location.x}, {location.y}</span>
          </p>
        </div>
      </header>

      {images.length > 0 && (
        <div className={`mb-6 grid gap-3 ${images.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {images.map((img) => (
            <figure key={img.src} className="overflow-hidden rounded-2xl border border-border bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt={`${location.name} — ${img.label}`} className="aspect-video w-full object-cover" loading="lazy" />
              <figcaption className="px-3 py-1.5 text-xs text-muted">{img.label}</figcaption>
            </figure>
          ))}
        </div>
      )}

      <section className="mb-8 text-sm leading-relaxed text-foreground/90">
        {location.description ? (
          <p>{location.description}</p>
        ) : (
          <p>
            <strong>{location.name}</strong> est un lieu de type <em>{category?.name?.toLowerCase() ?? "landmark"}</em>
            {location.area ? ` situé dans la zone ${location.area}` : ""} de l&apos;État de Leonida (GTA VI).
            {location.realWorld.name && (
              <>
                {" "}Il s&apos;inspire de <strong>{location.realWorld.name}</strong>
                {location.realWorld.address ? ` (${location.realWorld.address})` : ""}
                {location.realWorld.status === "unconfirmed" ? " — correspondance non confirmée." : "."}
              </>
            )}
            {location.height !== null && ` Hauteur estimée : ${Math.round(location.height)} m.`}
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/?l=${location.slug}`}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-deep"
        >
          <MapPin className="h-4 w-4" /> Ouvrir sur la carte interactive
        </Link>
        {location.wiki && (
          <a
            href={location.wiki.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rs-pill inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
          >
            <BookOpen className="h-4 w-4 text-accent-2" /> GTA Wiki <ExternalLink className="h-3 w-3 text-muted" />
          </a>
        )}
      </div>

      {nearby.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-lg font-bold">À proximité</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {nearby.map(({ l, d }) => (
              <li key={l.id}>
                <Link href={`/location/${l.slug}`} className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-2">
                  <span className="truncate">{l.name}</span>
                  <span className="ml-3 shrink-0 font-mono text-xs text-muted">{Math.round(d)} m</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
