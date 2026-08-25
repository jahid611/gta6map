"use client";

import { useMemo } from "react";
import { RotateCcw, Trophy } from "@/components/ui/icons";
import type { CategoryWithCount, ProgressSummary } from "@/types";
import { useProgressStore } from "@/store/useProgressStore";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { formatPercent } from "@/lib/utils";
import { pastel } from "@/lib/colors";

interface ProgressOverviewProps {
  categories: readonly CategoryWithCount[];
  global: ProgressSummary;
  syncStatus: "local" | "synced" | "pending";
}

/** Complétion globale + par catégorie (uniquement catégories `trackable` non vides). */
export function ProgressOverview({ categories, global, syncStatus }: ProgressOverviewProps) {
  const resetAll = useProgressStore((s) => s.resetAll);
  const tracked = useMemo(
    () => categories.filter((c) => c.trackable && c.total > 0).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  return (
    <div className="flex flex-col gap-5 p-4">
      <section className="rounded-xl border border-border bg-gradient-to-br from-surface-2 to-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Trophy className="h-4 w-4 text-accent" /> Complétion globale
          </h3>
          <span className="vi-num text-lg font-bold ">{formatPercent(global.percent)}</span>
        </div>
        <Progress value={global.percent} />
        <p className="mt-2 text-xs text-muted">
          {global.found} / {global.total} éléments trouvés ·{" "}
          {syncStatus === "synced" ? "synchronisé" : syncStatus === "pending" ? "synchronisation…" : "sauvegarde locale"}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        {tracked.map((c) => {
          const pct = c.total ? (c.found / c.total) * 100 : 0;
          return (
            <div key={c.slug}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: pastel(c.color) }} />
                  {c.name}
                </span>
                <span className="vi-num text-muted-2">
                  <span className="font-semibold text-foreground">{c.found}</span>
                  <span className="mx-1 opacity-40">·</span>
                  {c.total}
                  <span className="ml-2 opacity-70">{formatPercent(pct)}</span>
                </span>
              </div>
              <Progress value={pct} color={pastel(c.color)} size="sm" />
            </div>
          );
        })}
      </section>

      <Button
        variant="outline"
        size="sm"
        className="self-start text-muted"
        onClick={() => {
          if (window.confirm("Réinitialiser toute la progression ?")) resetAll();
        }}
      >
        <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
      </Button>
    </div>
  );
}
