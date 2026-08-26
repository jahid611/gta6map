import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GTA6MAP — Carte interactive GTA VI",
    short_name: "GTA6MAP",
    description: "Carte interactive GTA VI — landmarks, collectibles, suivi de complétion.",
    start_url: "/map",
    display: "standalone",
    orientation: "any",
    background_color: "#0b0f14",
    theme_color: "#0b0f14",
    lang: "fr",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
