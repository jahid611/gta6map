import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Trophy } from "@/components/ui/icons";
import { getPublicProfile } from "@/lib/community/server";
import { getCategories, getLocations } from "@/lib/data/locations";
import { CATEGORY_GROUP_LABELS } from "@/lib/data/categories";
import type { CategoryGroup } from "@/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/u/[id]">): Promise<Metadata> {
  const { id } = await params;
  const profile = await getPublicProfile(id);
  return { title: profile ? `${profile.displayName} — profil` : "Profil", robots: { index: false } };
}

/** Profil public : bannière, avatar, stats de complétion par groupe. */
export default async function PublicProfilePage({ params }: PageProps<"/u/[id]">) {
  const { id } = await params;
  const [profile, categories, locations] = await Promise.all([getPublicProfile(id), getCategories(), getLocations()]);
  if (!profile) notFound();

  const trackable = new Set(categories.filter((c) => c.trackable).map((c) => c.slug));
  const total = locations.filter((l) => trackable.has(l.categorySlug)).length;
  const percent = total ? (profile.foundCount / total) * 100 : 0;
  const groupTotals: Record<string, number> = {};
  for (const l of locations) {
    const c = categories.find((x) => x.slug === l.categorySlug);
    if (!c?.trackable) continue;
    groupTotals[c.group] = (groupTotals[c.group] ?? 0) + 1;
  }
  const groups = (Object.keys(groupTotals) as CategoryGroup[]).filter((g) => groupTotals[g] > 0);
  const initials = profile.displayName.slice(0, 2).toUpperCase();

  return (
    <main className="mx-auto max-w-2xl px-5 py-8 sm:py-12">
      <div className="mb-8 flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-3" aria-label="Accueil">
          <Image src="/brand/gta-vi-logo.svg" alt="" width={980} height={744} unoptimized className="h-8 w-auto" />
          <span className="vi-kicker text-muted">Interactive Map</span>
        </Link>
        <Link href="/community" className="rs-pill inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
          <ArrowLeft className="h-4 w-4" /> Communauté
        </Link>
      </div>

      <section className="relative overflow-hidden rounded-3xl">
        <div className="relative h-52 sm:h-64">
          {profile.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.bannerUrl} alt="" className="h-full w-full object-cover object-[50%_30%]" />
          ) : (
            <div className="h-full w-full bg-[image:var(--gradient-vi)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-5 text-white">
          <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-white/90 bg-[image:var(--gradient-vi)] font-display text-2xl font-black shadow-[0_8px_30px_rgba(0,0,0,0.6)] sm:h-24 sm:w-24">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              initials
            )}
          </span>
          <div className="min-w-0">
            <h1 className="font-display truncate text-3xl font-extrabold leading-none tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]">{profile.displayName}</h1>
            <p className="mt-1 text-sm text-white/70">Membre depuis {new Date(profile.memberSince).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</p>
          </div>
        </div>
      </section>

      <dl className="grid grid-cols-3 gap-3 border-b border-white/10 py-5 text-center">
        <div><dt className="text-[10px] uppercase tracking-wide text-muted">Lieux trouvés</dt><dd className="vi-num text-2xl font-extrabold">{profile.foundCount}</dd></div>
        <div><dt className="text-[10px] uppercase tracking-wide text-muted">Marqueurs</dt><dd className="vi-num text-2xl font-extrabold">{profile.customMarkers}</dd></div>
        <div><dt className="text-[10px] uppercase tracking-wide text-muted">Messages</dt><dd className="vi-num text-2xl font-extrabold">{profile.messagesCount}</dd></div>
      </dl>

      <section className="py-5">
        <div className="flex items-end justify-between">
          <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted"><Trophy className="h-3.5 w-3.5 text-accent" /> Complétion</h2>
          <span className="vi-num text-3xl font-extrabold leading-none">{Math.round(percent)} %</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[image:var(--gradient-vi-h)]" style={{ width: `${percent}%` }} />
        </div>
        <ul className="mt-4 divide-y divide-white/[0.06]">
          {groups.map((g) => {
            const n = profile.byGroup[g] ?? 0;
            const t = groupTotals[g];
            return (
              <li key={g} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">{CATEGORY_GROUP_LABELS[g]}</span>
                <span className="h-1.5 w-28 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-accent/70" style={{ width: `${t ? (n / t) * 100 : 0}%` }} /></span>
                <span className="vi-num w-20 text-right text-xs text-muted"><span className="text-foreground">{n}</span>/{t}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
