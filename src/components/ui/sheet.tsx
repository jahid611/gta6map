"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/**
 * Sheet (drawer) basé sur Radix Dialog. `side="bottom"` = modal rétractable
 * mobile ; `side="left"` = panneau latéral.
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: "left" | "bottom";
  title: string;
  description?: string;
  hideClose?: boolean;
}

export function SheetContent({
  side = "bottom",
  title,
  description,
  hideClose,
  className,
  children,
  ...props
}: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[1100] bg-black/50 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-[1101] flex flex-col bg-surface text-foreground shadow-2xl border-border focus:outline-none",
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t animate-drawer-up pb-safe",
          side === "left" && "inset-y-0 left-0 w-[92vw] max-w-sm border-r animate-drawer-left",
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="sr-only">{description ?? title}</DialogPrimitive.Description>
        {side === "bottom" && (
          <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-border" aria-hidden />
        )}
        {!hideClose && (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-muted hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        )}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
