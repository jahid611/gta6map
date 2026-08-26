"use client";

import { useEffect, useRef } from "react";

/**
 * Fond animé de la communauté : la ville en points, au crépuscule.
 *
 * Posé en `fixed` derrière le fil de discussion, jamais en z négatif —
 * `globals.css` peint un fond sur `body`, qui recouvrirait tout descendant passé
 * derrière lui.
 *
 * Deux voiles par-dessus la vidéo. Le premier, uniforme, ramène l'ensemble au
 * niveau d'un décor : le motif reste lisible, les messages passent devant sans
 * lutter. Le second assombrit le bas, où la zone de saisie se pose et où la
 * vidéo est justement la plus lumineuse.
 */
export function CommunityBackdrop() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // React ne sérialise pas l'attribut `muted` dans le HTML rendu côté serveur :
    // sans ces deux lignes, le navigateur refuse la lecture automatique et le
    // fond reste figé sur l'affiche.
    video.muted = true;
    video.defaultMuted = true;
    // Sous `prefers-reduced-motion`, l'affiche suffit : un décor qui bouge en
    // permanence derrière un texte qu'on lit est exactement ce que ce réglage
    // demande d'éviter.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    void video.play().catch(() => {});
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <video
        ref={videoRef}
        src="/brand/sunset-ascii.webm"
        poster="/brand/sunset-ascii.jpg"
        muted
        loop
        playsInline
        preload="auto"
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-background/55" />
      {/* Assombri en haut et en bas seulement : c'est là que se posent la barre
          de navigation et la zone de saisie. Au milieu, le motif reste net —
          un voile uniforme assez épais pour ces deux bandes effaçait le décor. */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-background/85 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-background via-background/70 to-transparent" />
    </div>
  );
}
