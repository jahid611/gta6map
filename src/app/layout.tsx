import type { Metadata, Viewport } from "next";
import { SiteNav } from "@/components/layout/SiteNav";
import { PageTransition } from "@/components/layout/PageTransition";
import { Archivo } from "next/font/google";
import "./globals.css";

/**
 * Typographie.
 *
 * GTA VI utilise « GTAArtDeco » (Colophon Foundry) : sa licence, embarquée dans
 * le fichier de police lui-même, la réserve strictement aux matériaux de marque
 * Rockstar Games et en interdit le partage à tout tiers non commissionné. Elle
 * est donc inutilisable ici, quand bien même des copies circulent sur GitHub.
 * Le site rockstargames.com, lui, compose en Helvetica Now (Monotype, payante).
 *
 * Helvetica Now (Monotype) est la police du site officiel. Elle est demandée en
 * premier dans `--font-sans` et `--font-display`, et employée dès qu'elle est
 * disponible — depuis le système, ou depuis `public/fonts/` si l'on y dépose
 * des fichiers sous licence (voir les @font-face de globals.css). Ses fichiers
 * ne sont pas versionnés ici : sa licence commerciale interdit d'en distribuer
 * les copies, ce qu'un webfont fait par construction.
 *
 * Archivo (Omnibus-Type, OFL) est le repli, et reste la police effective tant
 * qu'Helvetica Now est absente : grotesque géométrique à axe de chasse variable
 * (`wdth` 62–125), ce qui permet d'approcher le lettrage large et compact de la
 * DA VI via `font-variation-settings: "wdth"` (cf. `.vi-display`).
 *
 * Le wordmark « GRAND THEFT AUTO VI » ne dépend d'aucune police : c'est un SVG
 * vectoriel officiel (`public/brand/gta-vi-logo.svg`).
 */
const fontText = Archivo({ variable: "--font-text", subsets: ["latin"], display: "swap", axes: ["wdth"] });
// `--font-archivo-display` et non `--font-display` : ce dernier est le token de
// thème Tailwind, qui compose la pile complète (Helvetica Now puis Archivo).
// Réutiliser le même nom faisait écraser le token par la valeur de `next/font`
// posée sur `<html>`, et les titres retombaient sur Archivo seul.
const fontDisplay = Archivo({ variable: "--font-archivo-display", subsets: ["latin"], display: "swap", axes: ["wdth"] });

/** Domaine canonique : gta6map.pro (surchargé par NEXT_PUBLIC_SITE_URL ; localhost en dev). */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || (process.env.NODE_ENV === "production" ? "https://gta6map.pro" : "http://localhost:3000");
export const SITE_NAME = "GTA6MAP";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "GTA6MAP — Carte interactive de Leonida & Vice City",
    template: "%s · GTA6MAP",
  },
  description:
    "Carte interactive GTA VI : 1 400+ lieux identifiés, plans des trailers et screenshots officiels géolocalisés, fiches GTA Wiki, suivi de complétion. Vice City, Leonida Keys, Port Gellhorn, Grassrivers, Ambrosia.",
  keywords: ["GTA VI", "GTA 6", "carte interactive", "map", "Vice City", "Leonida", "Leonida Keys", "Port Gellhorn", "trailer", "landmarks"],
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "GTA6MAP — Carte interactive de Leonida & Vice City",
    description: "Explorez Leonida : lieux, plans des trailers géolocalisés, fiches wiki, suivi de complétion.",
    locale: "fr_FR",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#111117",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${fontText.variable} ${fontDisplay.variable} h-full antialiased`}>
      <body className="min-h-full">
        <PageTransition />
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
