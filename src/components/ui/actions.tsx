"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Rangée d'actions discrètes, reprise du registre shadcn
 * (21st.dev, `vercel/actions`, via `designali-in/ai-actions`).
 *
 * Des boutons fantômes carrés, alignés sous un message, dont l'intitulé n'existe
 * qu'au survol et pour les lecteurs d'écran. C'est ce qui remplace nos pastilles
 * bordées et la barre flottante qui les accompagnait.
 */
export type ActionsProps = ComponentProps<"div">;

export function Actions({ className, children, ...props }: ActionsProps) {
  return (
    <div className={cn("flex items-center gap-0.5", className)} {...props}>
      {children}
    </div>
  );
}

export type ActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

export function Action({ tooltip, children, label, className, variant = "ghost", size = "icon-sm", ...props }: ActionProps) {
  const button = (
    <Button
      className={cn("rounded-full text-muted hover:text-foreground", className)}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  );

  if (!tooltip) return button;

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
