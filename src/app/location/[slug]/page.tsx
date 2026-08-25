import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@/components/ui/icons";
import { RevealProvider } from "@/components/landing/RevealProvider";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { getCategories, getLocationBySlug, getLocations, getStaticLocationSlugs } from "@/lib/data/locations";
import { frameUrl, photoUrl, wikiImageUrl } from "@/lib/media";
import { MEDIA_CATALOG } from "@/lib/media-catalog";
import { SITE_NAME, SITE_URL } from "@/app/layout";
import { LocationPageBody, type PageImage } from "./LocationPageBody";

export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  return getStaticLocationSlugs().map((slug) => ({ slug }));
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
  const image = frameUrl(location.media?.frame) ?? photoUrl(location.photos.ig) ?? wikiImageUrl(location.wiki);

  return {
    title,
    description,
    alternates: { canonical: `/location/${location.slug}` },
    openGraph: { title, description, type: "article", images: image ? [{ url: image }] : undefined },
  };
}

/**
 * Page dédiée d'un lieu (SSG + ISR).
 *
 * Reste un composant serveur : c'est elle qui porte le rendu statique, le
 * JSON-LD et les métadonnées indexables. Seul ce qui réclame de l'interaction
 * — visionneuse, copie des coordonnées — bascule côté client dans
 * `LocationPageBody`.
 */
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
    .slice(0, 6)
    .map(({ l, d }) => {
      const cat = categories.find((c) => c.slug === l.categorySlug);
      return {
        slug: l.slug,
        name: l.name,
        distance: d,
        color: cat?.color ?? l.color,
        icon: cat?.icon ?? "MapPin",
      };
    });

  const images: PageImage[] = [
    { src: frameUrl(location.media?.frame), label: location.media ? `${location.media.sourceLabel} — © Rockstar Games` : "" },
    { src: photoUrl(location.photos.ig), label: "Capture in-game" },
    { src: wikiImageUrl(location.wiki), label: "GTA Wiki" },
    { src: photoUrl(location.photos.irl), label: "Lieu réel" },
  ].filter((i): i is PageImage => !!i.src);

  /**
   * Illustration de repli quand le lieu n'a aucune image.
   *
   * Tirée de la galerie des visuels officiels, en variant selon le slug : chaque
   * page a la sienne, et l'ensemble du site tourne au lieu d'afficher partout le
   * même écran vide. Le choix est déterministe plutôt qu'aléatoire — la page est
   * mise en cache (ISR), un tirage à chaque rendu ne changerait rien pour le
   * visiteur tout en rendant les captures et le débogage imprévisibles.
   *
   * Elle est signalée comme décorative : ce n'est pas une photo de ce lieu, et
   * l'afficher comme telle serait trompeur.
   */
  const backdrops = MEDIA_CATALOG.filter((m) => m.kind === "screenshot" || m.kind === "artwork");
  const fallbackHero =
    images.length === 0 && backdrops.length > 0
      ? backdrops[[...location.slug].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % backdrops.length].src
      : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
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

  /**
   * Description de repli, rédigée à partir des données.
   *
   * Elle n'est pas décorative : sans texte, la page n'aurait rien d'indexable
   * au-delà de son titre, alors que ces pages existent précisément pour ça.
   */
  const summary =
    location.description ??
    [
      `${location.name} est un lieu de type ${category?.name?.toLowerCase() ?? "landmark"}`,
      location.area ? ` situé dans la zone ${location.area}` : "",
      " de l’État de Leonida (GTA VI).",
      location.realWorld.name
        ? ` Il s’inspire de ${location.realWorld.name}${location.realWorld.address ? ` (${location.realWorld.address})` : ""}${
            location.realWorld.status === "unconfirmed" ? " — correspondance non confirmée." : "."
          }`
        : "",
      location.height !== null ? ` Hauteur estimée : ${Math.round(location.height)} m.` : "",
    ].join("");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="fixed left-4 top-4 z-50 text-sm">
        <Link href="/map" className="rs-pill inline-flex items-center gap-2 px-4 py-2 text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour à la carte
        </Link>
      </nav>

      <RevealProvider>
        <main>
          <LocationPageBody
            location={location}
            category={category}
            images={images}
            nearby={nearby}
            summary={summary}
            fallbackHero={fallbackHero}
          />
        </main>
        <LandingFooter />
      </RevealProvider>
    </>
  );
}
