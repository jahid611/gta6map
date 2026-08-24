import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Tuiles : si un miroir local existe (`npm run assets:mirror` → public/tiles/yanis,15)
 * et qu'aucune URL n'est forcée, on sert depuis /tiles (latence nulle en dev).
 */
const LOCAL_TILES = existsSync(path.join(process.cwd(), "public", "tiles", "yanis,15", "6"));
if (!process.env.NEXT_PUBLIC_TILES_BASE_URL && LOCAL_TILES) {
  process.env.NEXT_PUBLIC_TILES_BASE_URL = "/tiles";
}

const tilesHost = safeHost(process.env.NEXT_PUBLIC_TILES_BASE_URL);
const photosHost = safeHost(process.env.NEXT_PUBLIC_PHOTOS_BASE_URL);
const framesHost = safeHost(process.env.NEXT_PUBLIC_FRAMES_BASE_URL);
const wikiHost = safeHost(process.env.NEXT_PUBLIC_WIKI_IMAGES_BASE_URL);

function safeHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const remoteHosts = [...new Set([tilesHost, photosHost, framesHost, wikiHost, "gta.wiki"].filter((h): h is string => !!h))];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_TILES_BASE_URL: process.env.NEXT_PUBLIC_TILES_BASE_URL ?? "",
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: remoteHosts.map((hostname) => ({ protocol: "https", hostname })),
  },
  async headers() {
    return [
      {
        // Tuiles et photos locales : cache CDN agressif (dossiers versionnés).
        source: "/(tiles|photos|frames|wiki|brand)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
