"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Cloud, Loader2, LogOut, Trophy } from "@/components/ui/icons";
import { useAuth } from "@/hooks/useAuth";
import { useProgressStore } from "@/store/useProgressStore";
import { useProgressSync } from "@/hooks/useProgressSync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { formatPercent } from "@/lib/utils";

interface AccountPanelProps {
  totals: { slug: string; name: string; color: string; total: number; ids: string[] }[];
  total: number;
}

/** Page « Mon compte » : profil, synchronisation, résumé de progression, déconnexion. */
export function AccountPanel({ totals, total }: AccountPanelProps) {
  const auth = useAuth();
  const router = useRouter();
  useProgressSync(auth.user?.id ?? null);
  const entries = useProgressStore((s) => s.entries);
  const dirty = useProgressStore((s) => s.dirty.length);
  const customMarkers = useProgressStore((s) => Object.keys(s.customMarkers).length);
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const found = useMemo(() => Object.values(entries).filter((e) => e.found).length, [entries]);
  const percent = total ? (found / total) * 100 : 0;

  if (!auth.enabled) {
    return (
      <div className="rs-card rounded-3xl p-6 text-sm">
        <h1 className="font-display text-2xl font-extrabold">Mon compte</h1>
        <p className="mt-2 text-muted">Les comptes ne sont pas activés (Supabase non configuré). Votre progression reste locale.</p>
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

  return (
    <div className="flex flex-col gap-4">
      <Link href="/map" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Retour à la carte</Link>

      <section className="rs-card flex items-center gap-4 rounded-3xl p-6">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[image:var(--gradient-vi)] font-display text-xl font-black text-white shadow-[0_0_24px_rgba(249,118,176,0.4)]">{initials}</span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-2xl font-extrabold tracking-tight">{auth.displayName}</h1>
          <p className="truncate text-sm text-muted">{auth.user.email}</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-success"><Cloud className="h-3.5 w-3.5" /> {dirty > 0 ? "Synchronisation…" : "Progression synchronisée"}</p>
        </div>
        <Button variant="outline" size="sm" onClick={async () => { await auth.signOut(); router.replace("/"); }}>
          <LogOut className="h-4 w-4" /> Déconnexion
        </Button>
      </section>

      <section className="rs-card rounded-3xl p-6">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Profil</h2>
        <form className="flex gap-2" onSubmit={saveName}>
          <Input value={currentName} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Pseudo" className="h-10 rounded-xl" />
          <Button type="submit" disabled={saving || !currentName.trim()} className="rounded-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null} Enregistrer
          </Button>
        </form>
      </section>

      <section className="rs-card rounded-3xl p-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Trophy className="h-4 w-4 text-accent" /> Complétion</h2>
          <span className="font-mono text-lg font-bold tabular-nums">{formatPercent(percent)}</span>
        </div>
        <Progress value={percent} />
        <p className="mt-2 text-xs text-muted">{found} / {total} lieux trouvés · {customMarkers} marqueur{customMarkers > 1 ? "s" : ""} personnalisé{customMarkers > 1 ? "s" : ""}</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {totals.map((c) => {
            const n = c.ids.reduce((acc, id) => acc + (entries[id]?.found ? 1 : 0), 0);
            return (
              <li key={c.slug} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-xs">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.name}</span>
                <span className="font-mono text-muted"><span className={n === c.total ? "text-success" : ""}>{n}</span>/{c.total}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
