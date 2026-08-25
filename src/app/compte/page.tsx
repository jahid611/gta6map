import type { Metadata } from "next";
import { getCategories, getLocations } from "@/lib/data/locations";
import { MEDIA_CATALOG } from "@/lib/media-catalog";
import { AccountPanel, type AvatarOption, type BannerOption } from "@/components/auth/AccountPanel";
import type { MontageItem } from "@/components/media/MediaMontage";
import avatarsJson from "@/data/generated/avatars.json";

export const metadata: Metadata = { title: "Mon compte", robots: { index: false } };
export const revalidate = 3600;

/** Bannières : artworks paysage (personnages, duos, cover) + screenshots des régions. */
function bannerOptions(): BannerOption[] {
  const out: BannerOption[] = [];
  for (const e of MEDIA_CATALOG) {
    if (e.kind === "artwork") {
      const landscape = [e.src, ...e.variants].find((v) => /_landscape\.(jpe?g|png|webp)$/i.test(v)) ?? e.src;
      out.push({ id: e.id, src: landscape, label: e.group, group: "Artworks" });
    } else if (e.kind === "screenshot" && e.section === "Places") {
      out.push({ id: e.id, src: e.src, label: e.title, group: e.group });
    }
  }
  // Jason & Lucia : screenshots « People » en tête, ils n'ont pas d'artwork solo.
  for (const name of ["Jason Duval", "Lucia Caminos"]) {
    const shots = MEDIA_CATALOG.filter((e) => e.kind === "screenshot" && e.section === "People" && e.group === name);
    for (const s of shots) out.push({ id: s.id, src: s.src, label: s.title, group: name });
  }
  return out;
}

/** Montage : les 9 clips officiels entrecoupés de screenshots « People » et « Places ». */
function montageItems(): MontageItem[] {
  const clips = MEDIA_CATALOG.filter((e) => e.kind === "clip" && !/cover art/i.test(e.group));
  const people = MEDIA_CATALOG.filter((e) => e.kind === "screenshot" && e.section === "People");
  const places = MEDIA_CATALOG.filter((e) => e.kind === "screenshot" && e.section === "Places");
  const items: MontageItem[] = [];
  clips.forEach((clip, i) => {
    items.push({ id: clip.id, kind: "video", src: clip.src, poster: clip.poster, title: clip.group, subtitle: "Clip officiel" });
    const shot = people.find((p) => p.group === clip.group && p.title.endsWith("01")) ?? people[i % people.length];
    if (shot) items.push({ id: shot.id, kind: "image", src: shot.src, title: shot.group, subtitle: shot.title });
    const place = places[i % places.length];
    if (place && i % 2 === 1) items.push({ id: place.id, kind: "image", src: place.src, title: place.group, subtitle: place.title });
  });
  return items;
}

export default async function AccountPage() {
  const [locations, categories] = await Promise.all([getLocations(), getCategories()]);
  const trackable = new Set(categories.filter((c) => c.trackable).map((c) => c.slug));
  const totals = categories
    .filter((c) => c.trackable)
    .map((c) => {
      const ids = locations.filter((l) => l.categorySlug === c.slug).map((l) => l.id);
      return { slug: c.slug, name: c.name, color: c.color, group: c.group, total: ids.length, ids };
    })
    .filter((c) => c.total > 0);
  const total = locations.filter((l) => trackable.has(l.categorySlug)).length;
  // `AccountPanel` rend lui-même le <main> en écran scindé (comme /auth).
  return (
    <AccountPanel
      totals={totals}
      total={total}
      avatars={avatarsJson as AvatarOption[]}
      banners={bannerOptions()}
      montage={montageItems()}
    />
  );
}
