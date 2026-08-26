"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  /** Nombre affiché en regard du libellé (facultatif). */
  count?: number;
  disabled?: boolean;
}

interface SelectProps {
  /** Intitulé lu par les lecteurs d'écran, et affiché en tête du menu. */
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
  /** Aligne le menu sur le bord droit du bouton plutôt que sur le gauche. */
  align?: "start" | "end";
}

/**
 * Choix unique dans une liste, en menu déroulant.
 *
 * Remplace les rangées de pastilles : à neuf personnages, la rangée passait sur
 * trois lignes et noyait le choix courant au milieu des autres. Ici le bouton
 * porte la valeur retenue, et la liste ne s'ouvre que le temps de choisir.
 *
 * Motif ARIA « listbox » écrit à la main plutôt qu'un composant de bibliothèque :
 * il n'y a ni sous-menu ni groupe ni recherche à gérer, et cela évite une
 * dépendance de plus pour un bouton et une liste.
 *
 * Le clavier suit la convention : flèches pour parcourir, Origine et Fin pour
 * les extrémités, Entrée ou Espace pour valider, Échap pour renoncer — le focus
 * revient alors au bouton, sinon il retomberait sur le corps du document.
 */
export function Select({ label, value, options, onChange, className, align = "start" }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value) ?? options[0];
  const selectable = useCallback((i: number) => !options[i]?.disabled, [options]);

  const close = useCallback(
    (focusButton = true) => {
      setOpen(false);
      if (focusButton) buttonRef.current?.focus();
    },
    [],
  );

  // Ouverture : on se pose sur la valeur courante plutôt qu'en tête de liste.
  const openList = () => {
    const i = options.findIndex((o) => o.value === value);
    setActive(i < 0 ? 0 : i);
    setOpen(true);
  };

  // Un clic hors du bloc referme, sans rendre le focus : le geste dit qu'on est
  // parti ailleurs.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // L'option survolée au clavier doit rester dans le cadre quand la liste défile.
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const step = (delta: number) => {
    setActive((i) => {
      let next = i;
      for (let n = 0; n < options.length; n++) {
        next = (next + delta + options.length) % options.length;
        if (selectable(next)) return next;
      }
      return i;
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "ArrowDown":
        e.preventDefault();
        step(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        step(-1);
        break;
      case "Home":
        e.preventDefault();
        setActive(options.findIndex((o) => !o.disabled));
        break;
      case "End":
        e.preventDefault();
        setActive(options.length - 1 - [...options].reverse().findIndex((o) => !o.disabled));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (selectable(active)) {
          onChange(options[active].value);
          close();
        }
        break;
    }
  };

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close(false) : openList())}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label} : ${selected?.label ?? ""}`}
        className="rs-pill inline-flex h-9 min-w-0 items-center gap-2 px-3.5 text-sm font-semibold text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="truncate">{selected?.label}</span>
        {typeof selected?.count === "number" && <span className="vi-num text-xs text-muted">{selected.count}</span>}
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-300", open && "-rotate-180")} />
      </button>

      {/* Le menu reste monté le temps de la sortie : démonté au clic, il
          disparaîtrait d'un coup au lieu de se replier. */}
      <div
        className={cn(
          "rs-card absolute z-[1300] mt-2 max-h-72 w-max min-w-[var(--rs-select-min,11rem)] max-w-[min(20rem,80vw)] overflow-y-auto overscroll-contain rounded-2xl p-1.5 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          align === "end" ? "right-0" : "left-0",
          open ? "visible translate-y-0 scale-100 opacity-100" : "invisible -translate-y-1 scale-[0.97] opacity-0",
        )}
      >
        <p className="vi-kicker px-2.5 pb-1.5 pt-1 text-[10px] text-muted">{label}</p>
        <ul ref={listRef} role="listbox" id={listId} aria-label={label} tabIndex={-1}>
          {options.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={isSelected} aria-disabled={o.disabled}>
                <button
                  type="button"
                  disabled={o.disabled}
                  onClick={() => {
                    onChange(o.value);
                    close();
                  }}
                  onPointerEnter={() => !o.disabled && setActive(i)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-colors cursor-pointer disabled:cursor-default disabled:opacity-35",
                    // Chaque option glisse en place, décalée d'un cran : c'est ce
                    // qui donne l'impression que la liste se déploie.
                    open ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
                    i === active && !o.disabled ? "bg-white/10 text-foreground" : "text-muted",
                    isSelected && "text-foreground",
                  )}
                  style={{ transitionDelay: open ? `${Math.min(i, 8) * 22}ms` : "0ms" }}
                >
                  <Check className={cn("h-3.5 w-3.5 shrink-0 text-accent", !isSelected && "opacity-0")} />
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {typeof o.count === "number" && <span className="vi-num text-xs opacity-60">{o.count}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
