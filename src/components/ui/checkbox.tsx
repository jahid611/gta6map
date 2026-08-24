"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type CheckboxProps = React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
  /** Couleur de fond quand coché (par défaut : accent). */
  color?: string;
};

export function Checkbox({ className, color, style, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer h-4 w-4 shrink-0 rounded border border-border bg-surface cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-transparent data-[state=checked]:text-white",
        className,
      )}
      style={{ ...style, ...(color ? ({ "--cb-color": color } as React.CSSProperties) : {}) }}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="flex items-center justify-center rounded-[3px]"
        style={{ background: color ?? "var(--accent)" }}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
