import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";

/**
 * Typographie : le site officiel utilise « Helvetica Now Display / Text »
 * (police propriétaire Monotype). Inter Tight / Inter en sont les équivalents
 * libres les plus proches. Pour utiliser Helvetica Now si vous disposez de la
 * licence : remplacer ces deux imports par `next/font/local` pointant vers
 * `src/app/fonts/HelveticaNowDisplay*.woff2` — les variables CSS restent identiques.
 */
const fontText = Inter({ variable: "--font-text", subsets: ["latin"], display: "swap" });
const fontDisplay = Inter_Tight({ variable: "--font-display", subsets: ["latin"], display: "swap", weight: ["600", "700", "800", "900"] });

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const SITE_NAME = "GTA VI Map — Leonida";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "GTA VI Map — Carte interactive de Leonida & Vice City",
    template: "%s · GTA VI Map",
  },
  description:
    "Carte interactive GTA VI : 1 400+ lieux identifiés, plans des trailers et screenshots officiels géolocalisés, fiches GTA Wiki, suivi de complétion. Vice City, Leonida Keys, Port Gellhorn, Grassrivers, Ambrosia.",
  keywords: ["GTA VI", "GTA 6", "carte interactive", "map", "Vice City", "Leonida", "Leonida Keys", "Port Gellhorn", "trailer", "landmarks"],
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "GTA VI Map — Carte interactive de Leonida & Vice City",
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
      <body className="min-h-full">{children}</body>
    </html>
  );
}
