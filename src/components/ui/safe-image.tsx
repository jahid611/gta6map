"use client";

import { useState } from "react";
import { resolveStoredMedia } from "@/lib/media-catalog";
import { useNearViewport } from "@/hooks/useNearViewport";
import { cn } from "@/lib/utils";

interface SafeImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string | null | undefined;
  /** Ce qui prend la place de l'image si elle manque. Un aplat dégradé par défaut. */
  fallback?: React.ReactNode;
}

/**
 * Image qui ne casse jamais.
 *
 * Le navigateur, devant une adresse qui ne répond pas, dessine son icône
 * d'image manquante — un rectangle gris barré, qui n'appartient à aucune charte
 * et signale une panne à l'utilisateur. Ici l'échec est intercepté : l'élément
 * disparaît et laisse un aplat de la palette, indiscernable d'un fond voulu.
 *
 * L'adresse est en outre remise sur le miroir courant : une bannière ou une
 * photo de profil enregistrée depuis un autre environnement pointe une adresse
 * qui n'existe plus ici, et c'est la première cause de ces images cassées.
 *
 * `key` sur l'adresse : sans lui, changer de photo après un échec garderait
 * l'état « cassée » et masquerait une image pourtant valable.
 */
export function SafeImage({ src, fallback, className, alt = "", loading, ...props }: SafeImageProps) {
  const resolved = resolveStoredMedia(src);
  const [failed, setFailed] = useState(false);
  // Une image demandée en `lazy` est réclamée dès qu'elle approche, sans
  // attendre qu'elle entre dans le champ : le navigateur reprend alors le
  // chargement qu'il avait différé, et elle est déjà là quand on y arrive.
  const { ref, near } = useNearViewport<HTMLImageElement>();

  if (!resolved || failed) {
    return <>{fallback ?? <span aria-hidden className={cn("block bg-[image:var(--gradient-vi)]", className)} />}</>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={resolved}
      ref={ref}
      src={resolved}
      alt={alt}
      className={className}
      loading={loading === "lazy" && near ? "eager" : loading}
      onError={() => setFailed(true)}
      {...props}
    />
  );
}
