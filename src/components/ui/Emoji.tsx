/**
 * Emoji rendu en image, identique sur toutes les plateformes.
 *
 * Jeu Twemoji (CC BY 4.0, crédité au pied du site) : l'artwork d'Apple, lui, ne
 * peut pas être hébergé — protégé, et sa licence de fonte n'autorise ni la
 * redistribution ni l'usage web. Sur Mac et iPhone la fonte du système reste de
 * toute façon disponible pour le repli ci-dessous.
 *
 * Seuls les huit emojis proposés par le sélecteur sont embarqués. Une réaction
 * portant autre chose — la colonne accepte n'importe quel texte court, une
 * requête forgée pourrait en glisser une — retombe sur le caractère lui-même
 * plutôt que sur une image manquante.
 */
const TWEMOJI: Record<string, string> = {
  "👍": "1f44d",
  "🔥": "1f525",
  "❤️": "2764",
  "😂": "1f602",
  "😮": "1f62e",
  "😢": "1f622",
  "👀": "1f440",
  "🎯": "1f3af",
};

export function Emoji({ char, className = "h-[1.15em] w-[1.15em]" }: { char: string; className?: string }) {
  const code = TWEMOJI[char];
  if (!code) {
    return (
      <span className="emoji" aria-hidden>
        {char}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/emoji/${code}.svg`}
      alt={char}
      // Les SVG font quelques centaines d'octets : les passer par l'optimiseur
      // d'images coûterait plus que de les servir tels quels.
      className={`inline-block align-[-0.15em] ${className}`}
      draggable={false}
      loading="lazy"
    />
  );
}
