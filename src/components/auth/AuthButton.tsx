"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Cloud, CloudOff, LogIn, LogOut, Trophy } from "@/components/ui/icons";
import type { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type AuthApi = ReturnType<typeof useAuth>;

/** Bouton compte du header : lien vers /auth, ou menu (profil, progression, déconnexion) une fois connecté. */
export function AuthButton({ auth }: { auth: AuthApi }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const search = useSearchParams();
  const next = `${pathname}${search.size ? `?${search.toString()}` : ""}`;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!auth.enabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="grid h-9 w-9 place-items-center rounded-lg text-muted" aria-label="Mode local">
            <CloudOff className="h-4 w-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent>Progression sauvegardée localement (base non configurée)</TooltipContent>
      </Tooltip>
    );
  }

  if (!auth.user) {
    return (
      <Button asChild variant="outline" size="sm" className="rs-pill" aria-disabled={auth.loading}>
        <Link href={`/auth?next=${encodeURIComponent(next)}`}>
          <LogIn className="h-4 w-4" /> <span className="hidden sm:inline">Connexion</span>
        </Link>
      </Button>
    );
  }

  const initials = (auth.displayName ?? "?").slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rs-pill flex items-center gap-2 py-1 pl-1 pr-2.5 text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu du compte"
      >
        <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-[image:var(--gradient-vi)] text-[11px] font-black text-white">
          {auth.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={auth.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            initials
          )}
        </span>
        <span className="hidden max-w-[120px] truncate font-medium sm:inline">{auth.displayName}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div role="menu" className="rs-card absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl p-1.5 text-sm animate-fade-in">
          <div className="px-3 py-2">
            <p className="truncate font-semibold">{auth.displayName}</p>
            <p className="truncate text-xs text-muted">{auth.user.email}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-success"><Cloud className="h-3 w-3" /> Synchronisé</p>
          </div>
          <Link role="menuitem" href="/compte" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-surface-2">
            <Trophy className="h-4 w-4 text-accent" /> Mon compte & progression
          </Link>
          <button role="menuitem" onClick={() => { setOpen(false); void auth.signOut(); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-surface-2 cursor-pointer">
            <LogOut className="h-4 w-4 text-muted" /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
