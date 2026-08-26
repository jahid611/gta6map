import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLandingStats } from "@/lib/landing-stats";
import { clipFor } from "@/lib/media-catalog";
import { RevealProvider } from "@/components/landing/RevealProvider";
import { LandingNav } from "@/components/landing/LandingNav";
import { Hero } from "@/components/landing/Hero";
import { StatsBand } from "@/components/landing/StatsBand";
import { FeatureSections } from "@/components/landing/FeatureSections";
import { TrailerGallery } from "@/components/landing/TrailerGallery";
import { TrailerSection } from "@/components/landing/TrailerSection";
import { CharacterSection } from "@/components/landing/CharacterSection";
import { RegionCarousel } from "@/components/landing/RegionCarousel";
import { ClosingCta } from "@/components/landing/ClosingCta";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { SITE_NAME, SITE_URL } from "./layout";

export const revalidate = 3600; // ISR : suit le rythme des données de la carte

export const metadata: Metadata = {
  title: "GTA VI Map — Carte interactive de Leonida & Vice City",
  description:
    "Explorez Leonida : lieux répertoriés, plans des trailers officiels géolocalisés, fiches wiki et suivi de complétion. Vice City, Leonida Keys, Port Gellhorn, Grassrivers, Ambrosia.",
  alternates: { canonical: "/" },
};

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const [{ l }, stats] = await Promise.all([searchParams, getLandingStats()]);

  // La carte vivait sur `/` avant d'être déplacée sur `/map` : les liens partagés
  // de la forme `/?l=slug` doivent continuer de tomber sur le bon lieu.
  if (typeof l === "string" && l) redirect(`/map?l=${encodeURIComponent(l)}`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "fr-FR",
    description: "Carte interactive GTA VI : lieux, trailers géolocalisés, wiki, suivi de complétion.",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/map?l={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingNav />
      <RevealProvider>
        <main>
          <Hero locationCount={stats.landmarks} regionCount={stats.regions.length} />
          <StatsBand stats={stats} />
          <FeatureSections stats={stats} />
          <TrailerGallery shots={stats.showcase} />

          <CharacterSection
            name="Jason Duval"
            tagline="Jason veut une vie tranquille. Elle ne cesse de se compliquer."
            bio="Jason a grandi entre arnaqueurs et petites frappes. Après un passage à l'armée censé solder une adolescence agitée, il s'est retrouvé dans les Keys à faire ce qu'il sait faire : travailler pour les convoyeurs de drogue du coin. Il serait peut-être temps d'essayer autre chose."
            images={[
              "/brand/characters/jason-1.webp",
              "/brand/characters/jason-3.webp",
              "/brand/characters/jason-2.webp",
            ]}
            clip={clipFor("Jason Duval")}
          />

          <CharacterSection
            name="Lucia Caminos"
            tagline="Lucia a passé sa vie à se battre. La prison lui a appris pour quoi."
            bio="Le père de Lucia lui a appris très tôt à encaisser. La vie à Leonida s'est chargée du reste, et la prison de Leonida Penitentiary a fini le travail. Elle n'a plus qu'une idée : basculer du bon côté de la chance, quel qu'en soit le prix."
            images={[
              "/brand/characters/lucia-2.webp",
              "/brand/characters/lucia-3.webp",
              "/brand/characters/lucia-1.webp",
            ]}
            clip={clipFor("Lucia Caminos")}
            reverse
          />

          <TrailerSection />
          <RegionCarousel regions={stats.regions} />
          <ClosingCta total={stats.landmarks} />
        </main>
        <LandingFooter />
      </RevealProvider>
    </>
  );
}
