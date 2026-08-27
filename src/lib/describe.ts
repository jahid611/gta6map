import type { Location } from "@/types";

/**
 * Un nom qui n'est qu'une adresse : « 1 Collins Ave », « 110 MacArthur Cswy »,
 * ou un code plus Google (« MP4C+5G7 Big Pine Key »).
 *
 * Le numéro doit être suivi d'une espace, et non simplement commencer le nom :
 * « 79th St West Drawbridge » est un pont qui porte un nom, pas un bâtiment
 * anonyme, et le déclarer sans nom aurait été faux.
 */
const ADDRESS_LIKE = /^(\d+\s|[0-9A-Z]{4}\+[0-9A-Z]{2,})/;

/** Nom de remplacement posé par l'import quand la source n'en donnait aucun. */
const PLACEHOLDER = /^Lieu L\d+$/;

export interface LocationSummary {
  /** Phrase composée des seuls champs renseignés. */
  text: string;
  /**
   * `known` — on rapporte un fait sur le lieu.
   * `unknown` — on constate qu'on ne sait pas. La fiche l'affiche en retrait :
   * c'est une réserve, pas une information.
   */
  tone: "known" | "unknown";
}

/**
 * Compose une phrase factuelle sur un lieu, à partir de ce qu'on sait de lui.
 *
 * Cent trois lieux sur mille cinq cent quarante portent une description ; les
 * autres n'affichaient qu'un nom, des coordonnées et une catégorie. La fiche
 * paraissait vide alors que la donnée était là : 1 043 lieux ont un équivalent
 * réel, avec adresse complète, qui n'était jamais rédigé.
 *
 * **Deux règles.**
 *
 * Rien n'est inventé — chaque proposition provient d'un champ renseigné, et le
 * degré de certitude est dit plutôt que gommé. Le jeu n'étant pas sorti, une
 * description rédigée à la place des faits serait une fabrication, et c'est
 * justement ce qui distingue ce site des autres cartes de fans.
 *
 * Rien n'est répété — la catégorie et la zone figurent déjà sous le titre, la
 * provenance du plan sur l'image. Une phrase qui les reprendrait allongerait la
 * fiche sans rien y ajouter, ce qui est une autre façon d'être vide. D'où un
 * `null` assumé quand il n'y a rien de plus à dire.
 *
 * À ne pas confondre avec le `summary` de `/location/[slug]`, composé côté
 * serveur : celui-là est fait pour être indexé et reprend donc le nom, le type
 * et la zone en toutes lettres, redondances comprises. Ici on écrit pour un
 * lecteur qui a déjà la fiche sous les yeux.
 */
export function describeLocation(location: Location): LocationSummary | null {
  const real = location.realWorld;
  const realName = real?.name?.trim() || null;
  const address = real?.address?.trim() || null;
  // Une correspondance non confirmée est annoncée comme telle. La nuance est le
  // prix à payer pour que le reste soit cru.
  const hedge = realName && real?.status !== "confirmed" ? " La correspondance reste à confirmer." : "";

  // Sans nom : la source n'en donnait aucun, l'import a posé un identifiant.
  // Le dire est plus utile que de meubler — le visiteur comprend que le point
  // est relevé mais pas encore identifié, et non que la fiche a échoué.
  if (PLACEHOLDER.test(location.name)) {
    return {
      text: "Lieu relevé et positionné, mais qu'aucune source n'a encore nommé.",
      tone: "unknown",
    };
  }

  // Pour toute identité, une adresse. On la donne en entier plutôt que de la
  // laisser en titre tronqué.
  if (ADDRESS_LIKE.test(location.name) && realName === location.name) {
    const full = address ? `${location.name}, ${address}` : location.name;
    return {
      text: `Bâtiment sans nom connu dans le jeu, repéré par sa seule adresse : ${full}.`,
      tone: "unknown",
    };
  }

  if (realName && realName !== location.name) {
    return { text: `Inspiré de ${realName}${address ? `, ${address}` : ""}.${hedge}`, tone: "known" };
  }

  if (realName) {
    return {
      text: `Reprend le nom d'un lieu réel${address ? `, à ${address}` : ""}.${hedge}`,
      tone: "known",
    };
  }

  // Catégorie, zone, coordonnées et provenance sont déjà à l'écran : il n'y a
  // rien à ajouter, et une phrase de plus ne ferait que les paraphraser.
  return null;
}
