import type { NextConfig } from "next";

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
