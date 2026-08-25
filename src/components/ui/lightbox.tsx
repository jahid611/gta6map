"use client";

import { useCallback, useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface LightboxImage {
  src: string;
  alt: string;
  caption?: string;
  /** Lien externe (source) affiché sous l'image. */
  href?: string;
  hrefLabel?: string;
}

interface LightboxProps {
  images: readonly LightboxImage[];
  index: number | null;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}

/** Visionneuse plein écran (« Full View ») avec navigation clavier / boutons. */
export function Lightbox({ images, index, onClose, onIndexChange }: LightboxProps) {
  const [current, setCurrent] = useState(index ?? 0);
  // Resynchronise l'index courant quand le parent ouvre une autre image (derived state).
  const [prevIndex, setPrevIndex] = useState(index);
  if (index !== prevIndex) {
    setPrevIndex(index);
    if (index !== null) setCurrent(index);
  }

  const go = useCallback(
    (delta: number) => {
      if (!images.length) return;
      const next = (current + delta + images.length) % images.length;
      setCurrent(next);
      onIndexChange?.(next);
    },
    [current, images.length, onIndexChange],
  );

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go]);

  const image = images[current];
  const open = index !== null && !!image;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[1300] bg-black/92 backdrop-blur-sm animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[1301] flex flex-col items-center justify-center p-3 focus:outline-none sm:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <DialogPrimitive.Title className="sr-only">{image?.alt ?? "Image"}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Visionneuse plein écran</DialogPrimitive.Description>

          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.src}
              alt={image.alt}
              className="max-h-[82vh] max-w-full rounded-2xl object-contain shadow-[0_30px_80px_rgba(0,0,0,0.7)] animate-fade-in"
              draggable={false}
            />
          )}

          <div className="pointer-events-none mt-3 flex w-full max-w-4xl items-center justify-between gap-3 text-sm text-muted">
            <span className="pointer-events-auto truncate">
              {image?.caption}
              {image?.href && (
                <a
                  href={image.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center gap-1 text-accent-2 hover:underline"
                >
                  {image.hrefLabel ?? "Source"} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </span>
            {images.length > 1 && (
              <span className="pointer-events-auto shrink-0 vi-num text-xs">
                {current + 1} / {images.length}
              </span>
            )}
          </div>

          {images.length > 1 && (
            <>
              <button
                className={cn(navBtn, "left-2 sm:left-6")}
                onClick={() => go(-1)}
                aria-label="Image précédente"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button className={cn(navBtn, "right-2 sm:right-6")} onClick={() => go(1)} aria-label="Image suivante">
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <DialogPrimitive.Close
            className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const navBtn =
  "absolute top-1/2 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white hover:bg-accent hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
