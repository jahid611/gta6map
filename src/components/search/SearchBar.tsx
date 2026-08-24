"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search, X } from "lucide-react";
import type { Category, Location } from "@/types";
import { LocationSearchIndex } from "@/lib/search";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { useMapStore } from "@/store/useMapStore";
import { useUIStore } from "@/store/useUIStore";
import { useProgressStore } from "@/store/useProgressStore";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  locations: readonly Location[];
  categoriesBySlug: ReadonlyMap<string, Category>;
  className?: string;
}

/**
 * Recherche instantanée (index en mémoire, sans réseau) avec navigation clavier.
 * Sélection ⇒ `flyTo` sur le marqueur + ouverture du panneau de détails.
 * Raccourci : Ctrl/⌘ + K.
 */
export function SearchBar({ locations, categoriesBySlug, className }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebouncedValue(query, 80);
  const flyTo = useMapStore((s) => s.flyTo);
  const selectLocation = useUIStore((s) => s.selectLocation);
  const entries = useProgressStore((s) => s.entries);

  const index = useMemo(() => new LocationSearchIndex(locations), [locations]);
  const results = useMemo(() => index.search(debounced, 8), [index, debounced]);

  // Réinitialise la sélection clavier quand la liste change (pattern « derived state »).
  const [prevResults, setPrevResults] = useState(results);
  if (results !== prevResults) {
    setPrevResults(results);
    setActive(0);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const choose = (location: Location) => {
    selectLocation(location.slug);
    flyTo([location.x, location.y], 6);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[active].location);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showList = open && query.trim().length > 0;

  return (
    <div
      className={cn("relative", className)}
      role="combobox"
      aria-expanded={showList}
      aria-haspopup="listbox"
      aria-controls="search-results"
      aria-owns="search-results"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        placeholder="Rechercher un lieu… (Ctrl K)"
        aria-label="Rechercher un lieu"
        aria-autocomplete="list"
        aria-controls="search-results"
        autoComplete="off"
        enterKeyHint="search"
        className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-9 text-sm shadow-inner placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2 [&::-webkit-search-cancel-button]:hidden"
      />
      {query && (
        <button
          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground cursor-pointer"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
          aria-label="Effacer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {showList && (
        <ul
          id="search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[60vh] overflow-auto rounded-xl border border-border bg-surface p-1 shadow-2xl"
        >
          {results.length === 0 && <li className="px-3 py-2 text-sm text-muted">Aucun résultat</li>}
          {results.map(({ location }, i) => {
            const cat = categoriesBySlug.get(location.categorySlug);
            const found = entries[location.id]?.found;
            return (
              <li
                key={location.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(location)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm",
                  i === active ? "bg-surface-2" : "hover:bg-surface-2/60",
                )}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cat?.color ?? location.color }} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate font-medium", found && "line-through opacity-60")}>{location.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {cat?.name}
                    {location.area ? ` · ${location.area}` : ""}
                  </span>
                </span>
                {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
