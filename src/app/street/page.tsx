import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DEFAULT_ZONE, getStreetWorld, getStreetZones } from "@/lib/data/street";
import { fitGameTransform } from "@/lib/street/build";
import { StreetView } from "@/components/street/StreetView";
import { SITE_NAME, SITE_URL } from "../layout";

export const revalidate = 3600;

export async function generateMetadata({ searchParams }: PageProps<"/street">): Promise<Metadata> {
  const { zone } = await searchParams;
  const world = await getStreetWorld(typeof zone === "string" ? zone : DEFAULT_ZONE);
  const name = world?.name ?? "Vice City";
  return {
    title: `Marcher dans ${name}`,
    description: `Explorez ${name} à pied, en 3D, et basculez entre le Miami réel et sa version GTA VI. ${world?.spots.length ?? 0} lieux répertoriés.`,
    alternates: { canonical: world ? `/street?zone=${world.id}` : "/street" },
  };
}

/**
 * Mode piéton.
 *
 * La carte du site répond à « où est-ce ? ». Cette page répond à « à quoi ça
 * ressemble, une fois qu'on y est ? ». Les rues sont celles de Miami, relevées
 * dans OpenStreetMap et remontées en volume ; les lieux qu'on y croise sont
 * ceux du site, à leurs coordonnées réelles confirmées, portant sur leur façade
 * la photo du lieu — et, d'une touche, la capture du jeu qui lui correspond.
 */
export default async function StreetPage({ searchParams }: PageProps<"/street">) {
  const [{ zone, l }, zones] = await Promise.all([searchParams, getStreetZones()]);
  const world = await getStreetWorld(typeof zone === "string" ? zone : DEFAULT_ZONE);
  if (!world) notFound();

  const transform = fitGameTransform(world.spots);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `${SITE_NAME} — mode piéton`,
    url: `${SITE_URL}/street`,
    applicationCategory: "GameApplication",
    operatingSystem: "Web",
    description:
      "Exploration 3D à la première personne des rues de Miami, avec bascule entre le monde réel et la carte GTA VI.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="sr-only">
        Marcher dans {world.name} — Miami réel et GTA VI, à la première personne
      </h1>
      <StreetView
        world={world}
        zones={zones}
        transform={transform}
        initialSlug={typeof l === "string" ? l : null}
      />
    </>
  );
}
