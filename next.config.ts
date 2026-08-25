import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Miroirs locaux : les dossiers d'assets (`public/{tiles,photos,frames,wiki}`) sont
 * ignorés par git — ils existent après `npm run setup` / `assets:mirror` mais jamais
 * sur un déploiement (Vercel). Si le dossier est là et qu'aucune URL n'est forcée,
 * on sert depuis /public (latence nulle en dev) ; sinon la variable reste vide et
 * `src/lib/media.ts` bascule sur la source publique d'origine (voir ce fichier).
 */
const LOCAL_MIRRORS: Record<string, { probe: string[]; base: string }> = {
  NEXT_PUBLIC_TILES_BASE_URL: { probe: ["tiles", "yanis,15", "6"], base: "/tiles" },
  NEXT_PUBLIC_PHOTOS_BASE_URL: { probe: ["photos", "gtadb"], base: "/photos" },
  NEXT_PUBLIC_FRAMES_BASE_URL: { probe: ["frames"], base: "/frames" },
  NEXT_PUBLIC_WIKI_IMAGES_BASE_URL: { probe: ["wiki"], base: "/wiki" },
  NEXT_PUBLIC_MEDIA_BASE_URL: { probe: ["media"], base: "/media" },
};

for (const [key, { probe, base }] of Object.entries(LOCAL_MIRRORS)) {
  const localExists = existsSync(path.join(process.cwd(), "public", ...probe));
  const value = process.env[key]?.trim() ?? "";
  if (!value && localExists) {
    process.env[key] = base;
  } else if (value.startsWith("/") && !localExists) {
    // Base relative (ex. `/photos` recopiée d'un .env.local) sans dossier local sur
    // ce déploiement : on l'ignore pour retomber sur la source publique d'origine,
    // sinon toutes les images seraient des 404 (placeholders).
    process.env[key] = "";
  }
}

function safeHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const mirrorHosts = Object.keys(LOCAL_MIRRORS).map((key) => safeHost(process.env[key]));
/** Hôtes des sources publiques utilisées à défaut de miroir (cf. `src/lib/media.ts`). */
const originHosts = ["gta.wiki", "map.gtadb.org", "maps.gtadb.org", safeHost(process.env.NEXT_PUBLIC_SUPABASE_URL)];
const remoteHosts = [...new Set([...mirrorHosts, ...originHosts].filter((h): h is string => !!h))];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Inlinées explicitement : elles sont dérivées ci-dessus, pas lues d'un `.env`.
  env: {
    NEXT_PUBLIC_TILES_BASE_URL: process.env.NEXT_PUBLIC_TILES_BASE_URL ?? "",
    NEXT_PUBLIC_PHOTOS_BASE_URL: process.env.NEXT_PUBLIC_PHOTOS_BASE_URL ?? "",
    NEXT_PUBLIC_FRAMES_BASE_URL: process.env.NEXT_PUBLIC_FRAMES_BASE_URL ?? "",
    NEXT_PUBLIC_WIKI_IMAGES_BASE_URL: process.env.NEXT_PUBLIC_WIKI_IMAGES_BASE_URL ?? "",
    NEXT_PUBLIC_MEDIA_BASE_URL: process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "",
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Next 16 n'accepte que les qualités listées ici ; toute autre valeur passée
    // à `next/image` retombe silencieusement sur 75. Les visuels de personnages
    // et les plans de trailers sont servis en 92.
    qualities: [75, 88, 90, 92],
    remotePatterns: remoteHosts.map((hostname) => ({ protocol: "https", hostname })),
  },
  async headers() {
    return [
      {
        // Tuiles et photos locales : cache CDN agressif (dossiers versionnés).
        source: "/(tiles|photos|frames|wiki|brand|media)/:path*",
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
