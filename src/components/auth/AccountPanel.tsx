"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Cloud, Loader2, LogOut, Trophy, X } from "@/components/ui/icons";
import { useAuth } from "@/hooks/useAuth";
import { useProgressStore } from "@/store/useProgressStore";
import { useProgressSync } from "@/hooks/useProgressSync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { MediaMontage, type MontageItem } from "@/components/media/MediaMontage";
import { cn, formatPercent } from "@/lib/utils";

export interface AvatarOption {
  id: string;
  character: string;
  label: string;
  src: string;
}

export interface BannerOption {
  id: string;
  src: string;
  label: string;
  group: string;
}

interface AccountPanelProps {
  totals: { slug: string; name: string; color: string; total: number; ids: string[] }[];
  total: number;
  avatars: AvatarOption[];
  banners: BannerOption[];
  montage: MontageItem[];
}

type Picker = "avatar" | "banner" | null;

/**
 * Page « Mon compte », même construction que /auth : écran scindé, 60 % d'infos
 * à gauche (bannière, avatar, pseudo, complétion) et 40 % de montage
 * vidéo-photos officiel à droite, pleine hauteur.
 */
export function AccountPanel({ totals, total, avatars, banners, montage }: AccountPanelProps) {
  const auth = useAuth();
  const router = useRouter();
  useProgressSync(auth.user?.id ?? null);
  const entries = useProgressStore((s) => s.entries);
  const dirty = useProgressStore((s) => s.dirty.length);
  const customMarkers = useProgressStore((s) => Object.keys(s.customMarkers).length);
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [picker, setPicker] = useState<Picker>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [avatarFilter, setAvatarFilter] = useState("all");
  const [bannerFilter, setBannerFilter] = useState("all");

  const found = useMemo(() => Object.values(entries).filter((e) => e.found).length, [entries]);
  const percent = total ? (found / total) * 100 : 0;
  const characters = useMemo(() => [...new Set(avatars.map((a) => a.character))], [avatars]);
  const bannerGroups = useMemo(() => [...new Set(banners.map((b) => b.group))], [banners]);
  const shownAvatars = avatarFilter === "all" ? avatars : avatars.filter((a) => a.character === avatarFilter);
  const shownBanners = bannerFilter === "all" ? banners : banners.filter((b) => b.group === bannerFilter);

  const currentAvatar = avatars.find((a) => auth.avatarUrl?.endsWith(a.src));
  const autoBanner = (currentAvatar && banners.find((b) => b.group === currentAvatar.character)) ?? banners[0];
  const bannerSrc = auth.bannerUrl ?? autoBanner?.src ?? null;

  const initials = (auth.displayName ?? "?").slice(0, 2).toUpperCase();
  const currentName = name ?? auth.displayName ?? "";

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const r = await auth.updateDisplayName(currentName);
    setSaving(false);
    if (!r.error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  };

  const chooseAvatar = async (src: string | null) => {
    setPending(src ?? "google");
    await auth.updateAvatar(src ? new URL(src, window.location.origin).href : null);
    setPending(null);
    setPicker(null);
  };

  const chooseBanner = async (src: string | null) => {
    setPending(src ?? "auto");
    await auth.updateBanner(src);
    setPending(null);
    setPicker(null);
  };

  const pill = (active: boolean) => cn("rs-pill px-3 py-1.5 text-xs font-semibold cursor-pointer", active && "rs-pill--accent");

  let content: React.ReactNode;
  if (!auth.enabled) {
    content = (
      <div className="text-sm">
        <h1 className="font-display text-2xl font-extrabold">Mon compte</h1>
        <p className="mt-2 text-muted">Les comptes ne sont pas activés (base non configurée). Votre progression reste locale.</p>
        <Link href="/map" className="rs-pill mt-5 inline-flex items-center gap-2 px-4 py-2 font-semibold"><ArrowLeft className="h-4 w-4" /> Carte</Link>
      </div>
    );
  } else if (auth.loading) {
    content = <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>;
  } else if (!auth.user) {
    router.replace("/auth?next=/compte");
    content = null;
  } else {
    content = (
      <div className="flex flex-col gap-5">
        {/* Bannière + identité */}
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
          <div className="relative h-40 sm:h-52">
            {bannerSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bannerSrc} alt="" className="h-full w-full object-cover object-[50%_30%]" />
            ) : (
              <div className="h-full w-full bg-[image:var(--gradient-vi)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(17,17,23,0.96)] via-[rgba(17,17,23,0.3)] to-transparent" />
            <button
              type="button"
              onClick={() => setPicker(picker === "banner" ? null : "banner")}
              className="rs-pill absolute right-3 top-3 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
            >
              Changer la bannière
            </button>
          </div>
          <div className="-mt-12 flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end">
            <button
              type="button"
              onClick={() => setPicker(picker === "avatar" ? null : "avatar")}
              className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-[#111117] bg-[image:var(--gradient-vi)] shadow-[0_0_30px_rgba(249,118,176,0.35)] cursor-pointer sm:h-28 sm:w-28"
              aria-label="Changer la photo de profil"
            >
              {auth.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={auth.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="grid h-full w-full place-items-center font-display text-3xl font-black text-white">{initials}</span>
              )}
              <span className="absolute inset-0 grid place-items-center bg-black/55 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">Changer</span>
            </button>
            <div className="min-w-0 flex-1 sm:pb-1">
              <h1 className="font-display truncate text-3xl font-extrabold tracking-tight">{auth.displayName}</h1>
              <p className="truncate text-sm text-muted">{auth.user.email}</p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-success">
                <Cloud className="h-3.5 w-3.5" /> {dirty > 0 ? "Synchronisation…" : "Progression synchronisée"}
              </p>
            </div>
            <Button variant="outline" size="sm" className="sm:mb-1" onClick={async () => { await auth.signOut(); router.replace("/"); }}>
              <LogOut className="h-4 w-4" /> Déconnexion
            </Button>
          </div>
        </section>

        {picker === "avatar" && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 animate-fade-in">
            <PickerHeader title="Photo de profil" subtitle="Visages des personnages de GTA VI, issus des screenshots et artworks officiels." onClose={() => setPicker(null)} />
            <div className="mb-4 flex flex-wrap gap-1.5">
              <button onClick={() => setAvatarFilter("all")} className={pill(avatarFilter === "all")}>Tous</button>
              {characters.map((c) => <button key={c} onClick={() => setAvatarFilter(c)} className={pill(avatarFilter === c)}>{c}</button>)}
            </div>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
              {auth.googleAvatarUrl && avatarFilter === "all" && (
                <li><Choice round src={auth.googleAvatarUrl} label="Photo Google" sub="Votre compte" selected={auth.avatarUrl === auth.googleAvatarUrl} busy={pending === "google"} onClick={() => chooseAvatar(null)} /></li>
              )}
              {shownAvatars.map((a) => (
                <li key={a.id}><Choice round src={a.src} label={a.character} sub={a.label.replace(/^[^—]+— /, "")} selected={!!auth.avatarUrl?.endsWith(a.src)} busy={pending === a.src} onClick={() => chooseAvatar(a.src)} /></li>
              ))}
            </ul>
          </section>
        )}

        {picker === "banner" && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 animate-fade-in">
            <PickerHeader title="Bannière" subtitle="Artworks et screenshots officiels : personnages et régions de Leonida." onClose={() => setPicker(null)} />
            <div className="mb-4 flex flex-wrap gap-1.5">
              <button onClick={() => setBannerFilter("all")} className={pill(bannerFilter === "all")}>Tous</button>
              {bannerGroups.map((g) => <button key={g} onClick={() => setBannerFilter(g)} className={pill(bannerFilter === g)}>{g}</button>)}
            </div>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {bannerFilter === "all" && (
                <li><Choice src={autoBanner?.src ?? ""} label="Automatique" sub="Suit votre avatar" selected={auth.bannerUrl === null} busy={pending === "auto"} onClick={() => chooseBanner(null)} /></li>
              )}
              {shownBanners.map((b) => (
                <li key={b.id}><Choice src={b.src} label={b.label} sub={b.group} selected={auth.bannerUrl === b.src} busy={pending === b.src} onClick={() => chooseBanner(b.src)} /></li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Pseudo</h2>
          <form className="flex gap-2" onSubmit={saveName}>
            <Input value={currentName} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Pseudo" className="h-11 rounded-xl border-white/10 bg-white/[0.06]" />
            <Button type="submit" disabled={saving || !currentName.trim()} className="h-11 rounded-full px-5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null} Enregistrer
            </Button>
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Trophy className="h-4 w-4 text-accent" /> Complétion</h2>
            <span className="font-mono text-2xl font-bold tabular-nums">{formatPercent(percent)}</span>
          </div>
          <Progress value={percent} />
          <p className="mt-2 text-xs text-muted">{found} / {total} lieux trouvés · {customMarkers} marqueur{customMarkers > 1 ? "s" : ""} personnalisé{customMarkers > 1 ? "s" : ""}</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {totals.map((c) => {
              const n = c.ids.reduce((acc, id) => acc + (entries[id]?.found ? 1 : 0), 0);
              return (
                <li key={c.slug} className="rounded-2xl border border-white/10 px-3 py-2.5 text-xs">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.name}</span>
                    <span className="font-mono text-muted"><span className={n === c.total ? "text-success" : ""}>{n}</span>/{c.total}</span>
                  </div>
                  <Progress value={c.total ? (n / c.total) * 100 : 0} color={c.color} size="sm" />
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    );
  }

  return (
    <main className="relative min-h-dvh lg:grid lg:grid-cols-[3fr_2fr]">
      {/* 60 % — informations */}
      <section className="flex flex-col px-5 py-6 sm:px-10 lg:px-14 lg:py-10">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="Accueil">
            <Image src="/brand/gta-vi-logo.svg" alt="" width={980} height={744} unoptimized className="h-9 w-auto" />
            <span className="vi-kicker text-muted">Interactive Map</span>
          </Link>
          <Link href="/map" className="rs-pill inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
            <ArrowLeft className="h-4 w-4" /> Retour à la carte
          </Link>
        </div>
        <div className="w-full max-w-3xl">{content}</div>
      </section>

      {/* 40 % — montage vidéo / photos, pleine hauteur (sous le contenu sur mobile) */}
      <aside className="relative min-h-[48vh] lg:sticky lg:top-0 lg:h-dvh lg:min-h-0">
        <MediaMontage items={montage} fill />
        <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-24 bg-gradient-to-r from-background to-transparent lg:block" />
      </aside>
    </main>
  );
}

function PickerHeader({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
      <button onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-muted hover:text-foreground cursor-pointer" aria-label="Fermer">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function Choice({ src, label, sub, selected, busy, onClick, round = false }: { src: string; label: string; sub: string; selected: boolean; busy: boolean; onClick: () => void; round?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        "group flex w-full flex-col items-center gap-1.5 rounded-2xl p-2 text-center transition-colors cursor-pointer hover:bg-white/[0.06]",
        selected && "bg-accent/15 ring-1 ring-accent",
      )}
      aria-pressed={selected}
    >
      <span className={cn("relative overflow-hidden border-2 border-white/10 group-hover:border-accent/60", round ? "h-20 w-20 rounded-full sm:h-24 sm:w-24" : "aspect-video w-full rounded-xl")}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={label} className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <span className="block h-full w-full bg-[image:var(--gradient-vi)]" />
        )}
        {busy && <span className="absolute inset-0 grid place-items-center bg-black/50"><Loader2 className="h-5 w-5 animate-spin text-white" /></span>}
        {selected && !busy && <span className="absolute bottom-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-accent text-white"><Check className="h-3.5 w-3.5" /></span>}
      </span>
      <span className="text-xs font-semibold leading-tight">{label}</span>
      <span className="text-[10px] leading-tight text-muted">{sub}</span>
    </button>
  );
}
