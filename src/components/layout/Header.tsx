"use client";

import Link from "next/link";
import Image from "next/image";
import { PanelLeft, SlidersHorizontal, Trophy } from "lucide-react";
import type { Category, Location, ProgressSummary } from "@/types";
import type { useAuth } from "@/hooks/useAuth";
import { useUIStore } from "@/store/useUIStore";
import { SearchBar } from "@/components/search/SearchBar";
import { AuthButton } from "@/components/auth/AuthButton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatPercent } from "@/lib/utils";

interface HeaderProps {
  locations: readonly Location[];
  categoriesBySlug: ReadonlyMap<string, Category>;
  global: ProgressSummary;
  auth: ReturnType<typeof useAuth>;
}

export function Header({ locations, categoriesBySlug, global, auth }: HeaderProps) {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setActivePanel = useUIStore((s) => s.setActivePanel);

  return (
    <header className="pt-safe relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur lg:gap-3 lg:px-4">
      <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={toggleSidebar} aria-label="Afficher/masquer le panneau">
        <PanelLeft className="h-4 w-4" />
      </Button>

      <Link href="/" className="rs-pill flex items-center gap-2.5 py-1 pl-1.5 pr-3" aria-label="GTA VI Map — accueil">
        <Image src="/brand/gta-vi-logo.png" alt="GTA VI" width={60} height={25} className="h-[25px] w-auto object-contain" priority />
        <span className="hidden flex-col leading-none sm:flex">
          <span className="rs-title text-[13px]">Leonida</span>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">Interactive map</span>
        </span>
      </Link>

      <SearchBar locations={locations} categoriesBySlug={categoriesBySlug} className="min-w-0 flex-1 lg:max-w-xl" />

      <button
        className="rs-pill hidden items-center gap-2 px-3 py-1.5 text-xs cursor-pointer md:flex"
        onClick={() => setActivePanel("progress")}
        aria-label="Voir la progression"
      >
        <Trophy className="h-3.5 w-3.5 text-accent" />
        <span className="font-mono tabular-nums">{formatPercent(global.percent)}</span>
        <Progress value={global.percent} size="sm" className="w-16" />
      </button>

      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setActivePanel("filters")} aria-label="Filtres">
        <SlidersHorizontal className="h-4 w-4" />
      </Button>

      <AuthButton auth={auth} />
    </header>
  );
}
