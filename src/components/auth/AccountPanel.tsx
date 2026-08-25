"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Cloud, Loader2, LogOut, Trophy, X } from "@/components/ui/icons";
import { useAuth } from "@/hooks/useAuth";
import { useProgressStore } from "@/store/useProgressStore";
import { useProgressSync } from "@/hooks/useProgressSync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn, formatPercent } from "@/lib/utils";

export interface AvatarOption {
  id: string;
  character: string;
  label: string;
  src: string;
}

interface AccountPanelProps {
  totals: { slug: string; name: string; color: string; total: number; ids: string[] }[];
  total: number;
  avatars: AvatarOption[];
  /** Artworks officiels (paysage) pour la bannière, par personnage. */
  banners: Record<string, string>;
}

/** Page « Mon compte » : bannière, photo de profil (Google ou avatar GTA), profil, complétion, déconnexion. */
export function AccountPanel({ totals, total, avatars, banners }: AccountPanelProps) {
  const auth = useAuth();
  const router = useRouter();
  useProgressSync(auth.user?.id ?? null);
  const entries = useProgressStore((s) => s.entries);
  const dirty = useProgressStore((s) => s.dirty.length);
  const customMarkers = useProgressStore((s) => Object.keys(s.customMarkers).length);
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const found = useMemo(() => Object.values(entries).filter((e) => e.found).length, [entries]);
  const percent = total ? (found / total) * 100 : 0;
  const characters = useMemo(() => [...new Set(avatars.map((a) => a.character))], [avatars]);
  const shown = filter === "all" ? avatars : avatars.filter((a) => a.character === filter);
  const currentAvatar = avatars.find((a) => auth.avatarUrl?.endsWith(a.src));
  const bannerSrc = (currentAvatar && banners[currentAvatar.character]) || banners["Jason Duval"] || Object.values(banners)[0] || null;

  if (!auth.enabled) {
    return (
      <div className="rs-card rounded-3xl p-6 text-sm">
        <h1 className="font-display text-2xl font-extrabold">Mon compte</h1>
        <p className="mt-2 text-muted">Les comptes ne sont pas activés (base non configurée). Votre progression reste locale.</p>
        <Link href="/map" className="rs-pill mt-4 inline-flex items-center gap-2 px-4 py-2 font-semibold"><ArrowLeft className="h-4 w-4" /> Carte</Link>
      </div>
    );
  }
  if (auth.loading) return <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>;
  if (!auth.user) {
    router.replace("/auth?next=/compte");
    return null;
  }

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
    setPendingAvatar(src ?? "google");
    const absolute = src ? `${window.location.origin}${src}` : null;
    await auth.updateAvatar(absolute);
    setPendingAvatar(null);
    setPickerOpen(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <Link href="/map" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Retour à la carte</Link>

      {/* Bannière + identité */}
      <section className="rs-card overflow-hidden rounded-3xl">
        <div className="relative h-44 sm:h-56">
          {bannerSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bannerSrc} alt="" className="h-full w-full object-cover object-[50%_30%]" />
          ) : (
            <div className="h-full w-full bg-[image:var(--gradient-vi)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(19,19,26,0.95)] via-[rgba(19,19,26,0.35)] to-transparent" />
          <p className="absolute right-4 top-3 text-[10px] text-white/50">© Rockstar Games</p>
        </div>
        <div className="-mt-14 flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="group relative h-28 w-28 shrink-0 overflow-hidden rounded-full border-4 border-[#13131a] bg-[image:var(--gradient-vi)] shadow-[0_0_30px_rgba(249,118,176,0.35)] cursor-pointer"
            aria-label="Changer la photo de profil"
          >
            {auth.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={auth.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="grid h-full w-full place-items-center font-display text-3xl font-black text-white">{initials}</span>
            )}
            <span className="absolute inset-0 grid place-items-center bg-black/55 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
              Changer
            </span>
          </button>
          <div className="min-w-0 flex-1 sm:pb-1">
            <h1 className="font-display truncate text-3xl font-extrabold tracking-tight">{auth.displayName}</h1>
            <p className="truncate text-sm text-muted">{auth.user.email}</p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-success">
              <Cloud className="h-3.5 w-3.5" /> {dirty > 0 ? "Synchronisation…" : "Progression synchronisée"}
            </p>
          </div>
          <div className="flex gap-2 sm:pb-1">
            <Button variant="secondary" size="sm" className="rs-pill" onClick={() => setPickerOpen(true)}>
              Photo de profil
            </Button>
            <Button variant="outline" size="sm" onClick={async () => { await auth.signOut(); router.replace("/"); }}>
              <LogOut className="h-4 w-4" /> Déconnexion
            </Button>
          </div>
        </div>
      </section>

      {/* Sélecteur d'avatar */}
      {pickerOpen && (
        <section className="rs-card rounded-3xl p-5 animate-fade-in">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold">Choisir une photo de profil</h2>
              <p className="text-xs text-muted">Visages des personnages de GTA VI, issus des screenshots et artworks officiels.</p>
            </div>
            <button onClick={() => setPickerOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-muted hover:text-foreground cursor-pointer" aria-label="Fermer">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <button onClick={() => setFilter("all")} className={cn("rs-pill px-3 py-1.5 text-xs font-semibold cursor-pointer", filter === "all" && "rs-pill--accent")}>Tous</button>
            {characters.map((c) => (
              <button key={c} onClick={() => setFilter(c)} className={cn("rs-pill px-3 py-1.5 text-xs font-semibold cursor-pointer", filter === c && "rs-pill--accent")}>{c}</button>
            ))}
          </div>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {auth.googleAvatarUrl && filter === "all" && (
              <li>
                <AvatarChoice src={auth.googleAvatarUrl} label="Photo Google" sub="Votre compte" selected={auth.avatarUrl === auth.googleAvatarUrl} busy={pendingAvatar === "google"} onClick={() => chooseAvatar(null)} />
              </li>
            )}
            {shown.map((a) => (
              <li key={a.id}>
                <AvatarChoice src={a.src} label={a.character} sub={a.label.replace(`${a.character.split(" ")[0]} — `, "")} selected={!!auth.avatarUrl?.endsWith(a.src)} busy={pendingAvatar === a.src} onClick={() => chooseAvatar(a.src)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Profil */}
      <section className="rs-card rounded-3xl p-6">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Pseudo</h2>
        <form className="flex gap-2" onSubmit={saveName}>
          <Input value={currentName} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Pseudo" className="h-11 rounded-xl" />
          <Button type="submit" disabled={saving || !currentName.trim()} className="h-11 rounded-full px-5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null} Enregistrer
          </Button>
        </form>
      </section>

      {/* Complétion */}
      <section className="rs-card rounded-3xl p-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Trophy className="h-4 w-4 text-accent" /> Complétion</h2>
          <span className="font-mono text-2xl font-bold tabular-nums">{formatPercent(percent)}</span>
        </div>
        <Progress value={percent} />
        <p className="mt-2 text-xs text-muted">{found} / {total} lieux trouvés · {customMarkers} marqueur{customMarkers > 1 ? "s" : ""} personnalisé{customMarkers > 1 ? "s" : ""}</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {totals.map((c) => {
            const n = c.ids.reduce((acc, id) => acc + (entries[id]?.found ? 1 : 0), 0);
            const pct = c.total ? (n / c.total) * 100 : 0;
            return (
              <li key={c.slug} className="rounded-2xl border border-white/10 px-3 py-2.5 text-xs">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.name}</span>
                  <span className="font-mono text-muted"><span className={n === c.total ? "text-success" : ""}>{n}</span>/{c.total}</span>
                </div>
                <Progress value={pct} color={c.color} size="sm" />
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function AvatarChoice({ src, label, sub, selected, busy, onClick }: { src: string; label: string; sub: string; selected: boolean; busy: boolean; onClick: () => void }) {
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
      <span className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-white/10 group-hover:border-accent/60 sm:h-24 sm:w-24">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
        {busy && <span className="absolute inset-0 grid place-items-center bg-black/50"><Loader2 className="h-5 w-5 animate-spin text-white" /></span>}
        {selected && !busy && <span className="absolute bottom-0 right-0 grid h-6 w-6 place-items-center rounded-full bg-accent text-white"><Check className="h-3.5 w-3.5" /></span>}
      </span>
      <span className="text-xs font-semibold leading-tight">{label}</span>
      <span className="text-[10px] leading-tight text-muted">{sub}</span>
    </button>
  );
}
