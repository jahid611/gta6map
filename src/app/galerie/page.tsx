import type { Metadata } from "next";
import { MEDIA_CATALOG } from "@/lib/media-catalog";
import { RevealProvider } from "@/components/landing/RevealProvider";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { MediaGrid } from "@/components/gallery/MediaGrid";
import { MediaCarousel } from "@/components/gallery/MediaCarousel";

export const metadata: Metadata = {
  title: "Galerie — screenshots, artworks et clips officiels",
  description:
    "Les visuels officiels de GTA VI : screenshots des personnages et des lieux de Leonida, artworks, clips vidéo. Galerie filtrable en pleine résolution.",
  alternates: { canonical: "/galerie" },
};

export default function GaleriePage() {
  const entries = MEDIA_CATALOG;
  // Selection douverture : des screenshots de lieux, larges et lisibles en grand.
  // Les clips sont ecartes — le carrousel montre une image fixe, une affiche de
  // video y perdrait ce qui fait son interet.
  const featured = entries.filter((e) => e.kind === "screenshot" && e.section === "Places").slice(0, 10);
  const screenshots = entries.filter((e) => e.kind === "screenshot").length;
  const artworks = entries.filter((e) => e.kind === "artwork").length;
  const clips = entries.filter((e) => e.kind === "clip").length;

  return (
    <>
      <RevealProvider>
        <main className="pt-28">
          <header className="mx-auto max-w-6xl px-5 text-center">
            <p className="vi-kicker text-accent">Médias officiels</p>
            <h1 className="vi-display mt-5 text-[clamp(2rem,6vw,4rem)]">
              Tout Leonida,
              <br />
              en pleine résolution
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted">
              <span className="vi-num font-semibold text-foreground">{screenshots}</span> screenshots,{" "}
              <span className="vi-num font-semibold text-foreground">{artworks}</span> artworks et{" "}
              <span className="vi-num font-semibold text-foreground">{clips}</span> clips publiés par Rockstar
              Games. Cliquez pour agrandir.
            </p>
          </header>

          <section className="mx-auto max-w-6xl px-5 py-14">
            {/* Une sélection en ouverture, la médiathèque complète en dessous :
                le carrousel donne à voir, la grille donne à chercher. */}
            <MediaCarousel entries={featured} />
            <MediaGrid entries={entries} />
          </section>
        </main>
        <LandingFooter />
      </RevealProvider>
    </>
  );
}
