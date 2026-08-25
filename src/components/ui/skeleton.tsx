import { cn } from "@/lib/utils";

/**
 * Bloc de chargement.
 *
 * Il occupe exactement la place du contenu à venir : c'est tout l'intérêt d'un
 * squelette par rapport à un simple spinner — la page ne saute pas quand le
 * contenu arrive. L'animation est neutralisée sous `prefers-reduced-motion`
 * (cf. `.vi-skeleton` dans globals.css), le bloc restant visible.
 */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("vi-skeleton block rounded-lg bg-surface-3", className)} />;
}
