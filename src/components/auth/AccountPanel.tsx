"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, Cloud, Loader2, LogOut, Trophy, X } from "@/components/ui/icons";
import { useAuth } from "@/hooks/useAuth";
import { useProgressStore } from "@/store/useProgressStore";
import { useProgressSync } from "@/hooks/useProgressSync";
import { MediaMontage, type MontageItem } from "@/components/media/MediaMontage";
import { cn, formatPercent } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { pastel } from "@/lib/colors";
import type { CategoryGroup } from "@/types";
import { CATEGORY_GROUP_LABELS } from "@/lib/data/categories";

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

export interface CategoryTotal {
  slug: string;
  name: string;
  color: string;
  group: CategoryGroup;
  total: number;
  ids: string[];
}

interface AccountPanelProps {
  totals: CategoryTotal[];
  total: number;
  avatars: AvatarOption[];
  banners: BannerOption[];
  montage: MontageItem[];
}

type Picker = "avatar" | "banner" | null;

/**
 * Page « Mon compte », même construction que /auth (écran scindé).
 * Colonne gauche à plat — pas de cartes imbriquées : une bannière-identité,
 * puis des blocs séparés par de simples filets.
 */
export function AccountPanel({ totals, total, avatars, banners, montage }: AccountPanelProps) {
  const auth = useAuth();
  const router = useRouter();
  useProgressSync(auth.user?.id ?? null);
  const entries = useProgressStore((s) => s.entries);
  const dirty = useProgressStore((s) => s.dirty.length);
  const customMarkers = useProgressStore((s) => Object.keys(s.customMarkers).length);
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
      <div className="flex flex-col">
        {/* ── Bannière-identité : pseudo, email et avatar posés SUR l'image ── */}
        <section className="relative overflow-hidden rounded-3xl">
          <div className="relative h-56 sm:h-64">
            {bannerSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bannerSrc} alt="" className="h-full w-full object-cover object-[50%_30%]" />
            ) : (
              <div className="h-full w-full bg-[image:var(--gradient-vi)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
            <button
              type="button"
              onClick={() => setPicker(picker === "banner" ? null : "banner")}
              className="rs-pill absolute right-3 top-3 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
            >
              Bannière
            </button>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-5">
            <button
              type="button"
              onClick={() => setPicker(picker === "avatar" ? null : "avatar")}
              className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-[3px] border-white/90 bg-[image:var(--gradient-vi)] shadow-[0_8px_30px_rgba(0,0,0,0.6)] cursor-pointer sm:h-24 sm:w-24"
              aria-label="Changer la photo de profil"
            >
              {auth.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={auth.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="grid h-full w-full place-items-center font-display text-2xl font-black text-white">{initials}</span>
              )}
              <span className="absolute inset-0 grid place-items-center bg-black/55 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">Changer</span>
            </button>
            <div className="min-w-0 flex-1 text-white">
              <NameEditor value={auth.displayName ?? ""} onSave={auth.updateDisplayName} />
              <p className="truncate text-sm text-white/70">{auth.user.email}</p>
            </div>
          </div>
        </section>

        {/* ── Ligne d'état ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 py-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5 text-success">
            <Cloud className="h-3.5 w-3.5" /> {dirty > 0 ? "Synchronisation…" : "Progression synchronisée"}
          </span>
          <button
            onClick={async () => { await auth.signOut(); router.replace("/"); }}
            className="inline-flex items-center gap-1.5 hover:text-foreground cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" /> Se déconnecter
          </button>
        </div>

        {picker === "avatar" && (
          <section className="border-t border-white/10 py-5 animate-fade-in">
            <PickerHeader title="Photo de profil" subtitle="Visages des personnages, issus des screenshots et artworks officiels." onClose={() => setPicker(null)} />
            <div className="mb-4">
              <Select
                label="Personnage"
                value={avatarFilter}
                onChange={setAvatarFilter}
                options={[{ value: "all", label: "Tous" }, ...characters.map((c) => ({ value: c, label: c }))]}
              />
            </div>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
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
          <section className="border-t border-white/10 py-5 animate-fade-in">
            <PickerHeader title="Bannière" subtitle="Artworks et screenshots officiels : personnages et régions de Leonida." onClose={() => setPicker(null)} />
            <div className="mb-4">
              <Select
                label="Collection"
                value={bannerFilter}
                onChange={setBannerFilter}
                options={[{ value: "all", label: "Tous" }, ...bannerGroups.map((g) => ({ value: g, label: g }))]}
              />
            </div>
            <ul className="grid grid-cols-2 gap-2">
              {bannerFilter === "all" && (
                <li><Choice src={autoBanner?.src ?? ""} label="Automatique" sub="Suit votre avatar" selected={auth.bannerUrl === null} busy={pending === "auto"} onClick={() => chooseBanner(null)} /></li>
              )}
              {shownBanners.map((b) => (
                <li key={b.id}><Choice src={b.src} label={b.label} sub={b.group} selected={auth.bannerUrl === b.src} busy={pending === b.src} onClick={() => chooseBanner(b.src)} /></li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Complétion : résumé d'abord, détail à la demande ── */}
        <CompletionPanel totals={totals} total={total} found={found} percent={percent} customMarkers={customMarkers} entries={entries} />
      </div>
    );
  }

  // Structure strictement identique à /auth : même grille, mêmes marges, même panneau média.
  return (
    <main className="relative min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <section className="relative flex flex-col px-6 pb-8 pt-24 sm:px-10 lg:px-16 lg:pb-12">
        {/* Le retour à la carte est dans la barre du site. */}
        <div className="my-auto w-full max-w-md">{content}</div>
      </section>

      <aside className="relative min-h-[38vh] overflow-hidden lg:sticky lg:top-0 lg:h-dvh lg:min-h-0" aria-label="Montage des médias officiels">
        <MediaMontage items={montage} fill />
      </aside>
    </main>
  );
}

/** Pseudo affiché en gros sur la bannière ; un clic le rend éditable, champ à la taille du texte. */
function NameEditor({ value, onSave }: { value: string; onSave: (name: string) => Promise<{ error: string | null }> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = async () => {
    const next = draft.trim();
    if (!next || next === value) return setEditing(false);
    setBusy(true);
    await onSave(next);
    setBusy(false);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="group inline-flex max-w-full items-center gap-2 text-left cursor-pointer"
        title="Modifier le pseudo"
      >
        <span className="font-display truncate text-3xl font-extrabold leading-none tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]">{value}</span>
        <span className="rs-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80 opacity-0 transition-opacity group-hover:opacity-100">modifier</span>
      </button>
    );
  }
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void commit();
      }}
    >
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
        maxLength={40}
        size={Math.max(6, Math.min(24, draft.length + 1))}
        className="font-display h-10 rounded-lg border border-white/30 bg-black/40 px-2 text-2xl font-extrabold tracking-tight text-white outline-none backdrop-blur focus:border-accent"
        aria-label="Pseudo"
      />
      <button type="submit" disabled={busy} className="grid h-9 w-9 place-items-center rounded-full bg-accent text-white cursor-pointer" aria-label="Enregistrer">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white cursor-pointer" aria-label="Annuler">
        <X className="h-4 w-4" />
      </button>
    </form>
  );
}

const GROUP_ORDER: CategoryGroup[] = ["gameplay", "landmark", "media"];

/**
 * Complétion lisible : un chiffre, une barre, et le détail replié. Ouvert, un
 * sélecteur de groupe (Gameplay / Lieux / Trailers) limite la liste à une poignée
 * de lignes, chacune avec sa barre — jamais tout d'un coup.
 */
function CompletionPanel({
  totals,
  total,
  found,
  percent,
  customMarkers,
  entries,
}: {
  totals: CategoryTotal[];
  total: number;
  found: number;
  percent: number;
  customMarkers: number;
  entries: Record<string, { found: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const groups = GROUP_ORDER.filter((g) => totals.some((t) => t.group === g && t.total > 0));
  const [group, setGroup] = useState<CategoryGroup>(groups[0] ?? "landmark");

  const rows = useMemo(
    () =>
      totals
        .filter((t) => t.group === group && t.total > 0)
        .map((t) => {
          const n = t.ids.reduce((acc, id) => acc + (entries[id]?.found ? 1 : 0), 0);
          return { ...t, found: n, pct: t.total ? (n / t.total) * 100 : 0 };
        })
        .sort((a, b) => b.pct - a.pct || b.total - a.total),
    [totals, group, entries],
  );
  const groupFound = rows.reduce((s, r) => s + r.found, 0);
  const groupTotal = rows.reduce((s, r) => s + r.total, 0);

  return (
    <section className="border-t border-white/10 py-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            <Trophy className="h-3.5 w-3.5 text-accent" /> Complétion
          </h2>
          <p className="mt-1 text-sm text-muted">
            <span className="vi-num text-foreground">{found}</span> / <span className="vi-num">{total}</span> lieux
            {customMarkers > 0 && (
              <>
                {" "}· <span className="vi-num text-foreground">{customMarkers}</span> marqueur{customMarkers > 1 ? "s" : ""} perso
              </>
            )}
          </p>
        </div>
        <span className="vi-num text-4xl font-extrabold leading-none">{formatPercent(percent)}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[image:var(--gradient-vi-h)] transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground cursor-pointer"
        aria-expanded={open}
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        {open ? "Masquer le détail" : "Voir le détail par catégorie"}
      </button>

      {open && (
        <div className="mt-4 animate-fade-in">
          <div className="flex items-center gap-1 rounded-full bg-white/[0.06] p-1 text-xs font-semibold" role="tablist">
            {groups.map((g) => (
              <button
                key={g}
                role="tab"
                aria-selected={group === g}
                onClick={() => setGroup(g)}
                className={cn("flex-1 rounded-full px-3 py-1.5 transition-colors cursor-pointer", group === g ? "bg-accent text-white" : "text-muted hover:text-foreground")}
              >
                {CATEGORY_GROUP_LABELS[g]}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            <span className="vi-num text-foreground">{groupFound}</span> / <span className="vi-num">{groupTotal}</span> dans ce groupe
          </p>
          <ul className="mt-2 divide-y divide-white/[0.06]">
            {rows.map((r) => {
              const tint = pastel(r.color);
              return (
                <li key={r.slug} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tint }} />
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-white/10 sm:block">
                    <span className="block h-full rounded-full" style={{ width: `${r.pct}%`, background: tint }} />
                  </span>
                  <span className="vi-num w-16 text-right text-xs text-muted">
                    <span className={cn("text-foreground", r.found === r.total && "text-success")}>{r.found}</span>/{r.total}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
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
      className="group flex w-full flex-col items-center gap-1.5 rounded-2xl p-2 text-center transition-colors cursor-pointer hover:bg-white/[0.06]"
      aria-pressed={selected}
    >
      {/* Le badge « ✔ » vit HORS du cadre `overflow-hidden` : sinon il est rogné par le cercle. */}
      <span className={cn("relative", round ? "h-20 w-20 sm:h-24 sm:w-24" : "aspect-video w-full")}>
        <span className={cn("block h-full w-full overflow-hidden border-2 border-white/10 group-hover:border-white/30", round ? "rounded-full" : "rounded-xl")}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={label} className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <span className="block h-full w-full bg-[image:var(--gradient-vi)]" />
          )}
          {busy && <span className="absolute inset-0 grid place-items-center rounded-[inherit] bg-black/50"><Loader2 className="h-5 w-5 animate-spin text-white" /></span>}
        </span>
        {selected && !busy && (
          <span className="absolute -bottom-0.5 -right-0.5 z-10 grid h-6 w-6 place-items-center rounded-full border-2 border-[#111117] bg-accent text-white shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
            <Check className="h-3.5 w-3.5" />
          </span>
        )}
      </span>
      <span className="text-xs font-semibold leading-tight">{label}</span>
      <span className="text-[10px] leading-tight text-muted">{sub}</span>
    </button>
  );
}
