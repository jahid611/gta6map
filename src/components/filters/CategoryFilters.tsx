"use client";

import { useMemo } from "react";
import { Eye, EyeOff, categoryIcon } from "@/components/ui/icons";
import type { CategoryWithCount } from "@/types";
import { CATEGORY_GROUP_LABELS, CATEGORY_GROUP_ORDER } from "@/lib/data/categories";
import { useFilterStore } from "@/store/useFilterStore";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pastel } from "@/lib/colors";

interface CategoryFiltersProps {
  categories: readonly CategoryWithCount[];
}

const GROUP_ORDER = CATEGORY_GROUP_ORDER;

/** Toggle par catégorie avec compteur (total / trouvés), groupé, + « masquer les trouvés ». */
export function CategoryFilters({ categories }: CategoryFiltersProps) {
  const hidden = useFilterStore((s) => s.hiddenCategories);
  const toggleCategory = useFilterStore((s) => s.toggleCategory);
  const showOnly = useFilterStore((s) => s.showOnly);
  const showAll = useFilterStore((s) => s.showAll);
  const hideAll = useFilterStore((s) => s.hideAll);
  const hideFound = useFilterStore((s) => s.hideFound);
  const setHideFound = useFilterStore((s) => s.setHideFound);

  const allSlugs = useMemo(() => categories.map((c) => c.slug), [categories]);
  const groups = useMemo(
    () =>
      GROUP_ORDER.map((group) => ({
        group,
        items: categories.filter((c) => c.group === group).sort((a, b) => a.sortOrder - b.sortOrder),
      })).filter((g) => g.items.length > 0),
    [categories],
  );

  const visibleCount = allSlugs.length - hidden.length;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          <span className="vi-num font-semibold text-foreground">{visibleCount}</span>
          <span className="mx-1 opacity-40">·</span>
          <span className="vi-num">{allSlugs.length}</span> catégories visibles
        </p>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={showAll}>
            <Eye className="h-3.5 w-3.5" /> Tout
          </Button>
          <Button variant="ghost" size="sm" onClick={() => hideAll(allSlugs)}>
            <EyeOff className="h-3.5 w-3.5" /> Aucun
          </Button>
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-sm">
        <span>Masquer les lieux trouvés</span>
        <Switch checked={hideFound} onCheckedChange={setHideFound} aria-label="Masquer les lieux trouvés" />
      </label>

      {groups.map(({ group, items }) => {
        const groupSlugs = items.map((i) => i.slug);
        const groupTotal = items.reduce((n, c) => n + c.total, 0);
        return (
          <section key={group}>
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                {CATEGORY_GROUP_LABELS[group]}
                <span className="ml-1.5 font-normal normal-case tracking-normal">({groupTotal})</span>
              </h3>
              <button
                className="text-[11px] text-muted hover:text-foreground cursor-pointer"
                onClick={() => showOnly(groupSlugs, allSlugs)}
              >
                Uniquement
              </button>
            </div>
            {groupTotal === 0 && (
              <p className="mb-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted">
                Aucun élément pour l&apos;instant — ces catégories seront alimentées à la sortie du jeu.
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {items.map((cat) => {
                const visible = !hidden.includes(cat.slug);
                const Icon = categoryIcon(cat.icon);
                const pct = cat.total ? Math.round((cat.found / cat.total) * 100) : 0;
                return (
                  <li key={cat.slug}>
                    <label
                      className={cn(
                        // La ligne entière est la cible tactile (44 px au doigt),
                        // pas la case : celle-ci reste une petite pastille de couleur.
                        "group flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface-2 sm:min-h-0",
                        !visible && "opacity-55",
                      )}
                      title={cat.description ?? undefined}
                    >
                      <Checkbox
                        checked={visible}
                        onCheckedChange={() => toggleCategory(cat.slug)}
                        color={pastel(cat.color)}
                        aria-label={cat.name}
                      />
                      {/* Icône nue, teintée à la couleur de la catégorie. La pastille
                          pleine derrière alourdissait la liste et écrasait les nuances
                          entre catégories voisines. */}
                      <Icon className="h-[1.05rem] w-[1.05rem] shrink-0" style={{ color: pastel(cat.color) }} />
                      <span className="flex-1 truncate">{cat.name}</span>
                      {/* Pas de barre oblique : le trouvé et le total se distinguent
                          par la graisse et la couleur, ce qui se lit mieux qu'un
                          « 0/43 » où le séparateur pèse autant que les chiffres. */}
                      <span className="vi-num shrink-0 text-[11px] text-muted-2">
                        {cat.trackable && cat.total > 0 ? (
                          <>
                            <span className={cn("font-semibold", pct === 100 ? "text-success" : "text-foreground")}>
                              {cat.found}
                            </span>
                            <span className="mx-1 opacity-40">·</span>
                            {cat.total}
                          </>
                        ) : (
                          cat.total
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
