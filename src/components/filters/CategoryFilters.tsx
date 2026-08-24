"use client";

import { useMemo } from "react";
import * as Icons from "lucide-react";
import { Eye, EyeOff } from "lucide-react";
import type { CategoryWithCount } from "@/types";
import { CATEGORY_GROUP_LABELS, CATEGORY_GROUP_ORDER } from "@/lib/data/categories";
import { useFilterStore } from "@/store/useFilterStore";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CategoryFiltersProps {
  categories: readonly CategoryWithCount[];
}

type LucideIcon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

function iconComponent(name: string): LucideIcon {
  const lib = Icons as unknown as Record<string, LucideIcon>;
  return lib[name] ?? Icons.MapPin;
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
          {visibleCount}/{allSlugs.length} catégories visibles
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
                const Icon = iconComponent(cat.icon);
                const pct = cat.total ? Math.round((cat.found / cat.total) * 100) : 0;
                return (
                  <li key={cat.slug}>
                    <label
                      className={cn(
                        "group flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface-2",
                        !visible && "opacity-55",
                      )}
                      title={cat.description ?? undefined}
                    >
                      <Checkbox
                        checked={visible}
                        onCheckedChange={() => toggleCategory(cat.slug)}
                        color={cat.color}
                        aria-label={cat.name}
                      />
                      <span
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-white"
                        style={{ background: cat.color }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex-1 truncate">{cat.name}</span>
                      <span className="font-mono text-[11px] tabular-nums text-muted">
                        {cat.trackable && cat.total > 0 ? (
                          <>
                            <span className={cn(pct === 100 && "text-success")}>{cat.found}</span>/{cat.total}
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
