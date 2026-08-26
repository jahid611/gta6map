"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cn } from "@/lib/utils";

type CheckboxProps = React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
  /** Couleur de fond quand coché (par défaut : accent). */
  color?: string;
};

export function Checkbox({ className, color, style, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-full border border-border bg-surface cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-transparent data-[state=checked]:text-white",
        className,
      )}
      style={{ ...style, ...(color ? ({ "--cb-color": color } as React.CSSProperties) : {}) }}
      {...props}
    >
      {/* Aplat plein, sans coche : à 16 px, le glyphe se réduisait à une tache
          et brouillait la couleur, seule information utile ici — c'est elle qui
          rattache la ligne à sa catégorie sur la carte. */}
      <CheckboxPrimitive.Indicator
        className="block h-full w-full rounded-full"
        style={{ background: color ?? "var(--accent)" }}
      />
    </CheckboxPrimitive.Root>
  );
}
