import type { Metadata } from "next";
import { MEDIA_CATALOG } from "@/lib/media-catalog";
import { RevealProvider } from "@/components/landing/RevealProvider";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { GalleryView } from "@/components/gallery/GalleryView";

export const metadata: Metadata = {
  title: "Galerie — screenshots, artworks et clips officiels",
  description:
    "Les visuels officiels de GTA VI : screenshots des personnages et des lieux de Leonida, artworks, clips vidéo. Galerie filtrable en pleine résolution.",
  alternates: { canonical: "/galerie" },
};

export default function GaleriePage() {
  const entries = MEDIA_CATALOG;
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

          <GalleryView entries={entries} />
        </main>
        <LandingFooter />
      </RevealProvider>
    </>
  );
}
