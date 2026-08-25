import type { Metadata } from "next";
import { getAreas, getCategories, getLocations, getSections } from "@/lib/data/locations";
import { AppShell } from "@/components/layout/AppShell";
import { SITE_NAME, SITE_URL } from "../layout";

export const revalidate = 3600; // ISR : données rafraîchies toutes les heures

export async function generateMetadata({ searchParams }: PageProps<"/map">): Promise<Metadata> {
  const { l } = await searchParams;
  const slug = typeof l === "string" ? l : null;
  if (!slug) return { alternates: { canonical: "/map" } };
  const locations = await getLocations();
  const location = locations.find((x) => x.slug === slug);
  if (!location) return { alternates: { canonical: "/map" } };
  return {
    title: location.name,
    description: `${location.name}${location.area ? ` (${location.area})` : ""} sur la carte interactive GTA VI — coordonnées ${location.x}, ${location.y}.`,
    alternates: { canonical: `/location/${location.slug}` },
  };
}

export default async function MapPage({ searchParams }: PageProps<"/map">) {
  const [{ l }, locations, categories, sections, areas] = await Promise.all([
    searchParams,
    getLocations(),
    getCategories(),
    getSections(),
    getAreas(),
  ]);
  const initialSlug = typeof l === "string" ? l : null;

  // Allège le payload client : la fiche wiki de zone est résolue côté client via `areas`
  // (sinon l'extrait est dupliqué sur ~1 400 lieux).
  const clientLocations = locations.map((loc) => (loc.areaWiki ? { ...loc, areaWiki: null } : loc));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: SITE_URL + "/map",
    applicationCategory: "GameApplication",
    operatingSystem: "Web",
    description: "Carte interactive GTA VI : lieux, trailers géolocalisés, wiki, suivi de complétion.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="sr-only">Carte interactive GTA VI — Leonida & Vice City</h1>
      <AppShell locations={clientLocations} categories={categories} sections={sections} areas={areas} initialSlug={initialSlug} />
    </>
  );
}
