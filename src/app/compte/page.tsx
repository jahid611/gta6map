import type { Metadata } from "next";
import { getCategories, getLocations } from "@/lib/data/locations";
import { MEDIA_CATALOG } from "@/lib/media-catalog";
import { AccountPanel, type AvatarOption } from "@/components/auth/AccountPanel";
import avatarsJson from "@/data/generated/avatars.json";

export const metadata: Metadata = { title: "Mon compte", robots: { index: false } };
export const revalidate = 3600;

/** Artwork paysage officiel de chaque personnage → bannière du profil. */
function characterBanners(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of MEDIA_CATALOG) {
    if (e.kind !== "artwork") continue;
    const landscape = [e.src, ...e.variants].find((v) => /_landscape\.(jpe?g|png|webp)$/i.test(v));
    if (landscape) out[e.group] = landscape;
  }
  // Jason & Lucia n'ont pas d'artwork solo : on prend un screenshot « People ».
  for (const name of ["Jason Duval", "Lucia Caminos"]) {
    if (out[name]) continue;
    const shot = MEDIA_CATALOG.find((e) => e.kind === "screenshot" && e.section === "People" && e.group === name);
    if (shot) out[name] = shot.src;
  }
  return out;
}

export default async function AccountPage() {
  const [locations, categories] = await Promise.all([getLocations(), getCategories()]);
  const trackable = new Set(categories.filter((c) => c.trackable).map((c) => c.slug));
  const totals = categories
    .filter((c) => c.trackable)
    .map((c) => {
      const ids = locations.filter((l) => l.categorySlug === c.slug).map((l) => l.id);
      return { slug: c.slug, name: c.name, color: c.color, total: ids.length, ids };
    })
    .filter((c) => c.total > 0);
  const total = locations.filter((l) => trackable.has(l.categorySlug)).length;
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <AccountPanel totals={totals} total={total} avatars={avatarsJson as AvatarOption[]} banners={characterBanners()} />
    </main>
  );
}
