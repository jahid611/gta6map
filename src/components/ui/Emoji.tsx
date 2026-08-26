/**
 * Emoji rendu en image, identique sur toutes les plateformes.
 *
 * Jeu Twemoji (CC BY 4.0) : c'est celui que Discord emploie pour les emojis
 * Unicode, d'où un rendu identique à ce qu'on y connaît.
 *
 * Seuls les huit emojis proposés par le sélecteur sont embarqués. Une réaction
 * portant autre chose — la colonne accepte n'importe quel texte court, une
 * requête forgée pourrait en glisser une — retombe sur le caractère lui-même,
 * rendu par la fonte du système (celle d'Apple sur Mac et iPhone).
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
      // Quelques centaines d'octets chacun : les passer par l'optimiseur
      // d'images coûterait plus cher que de les servir tels quels.
      className={`inline-block align-[-0.15em] ${className}`}
      draggable={false}
      loading="lazy"
    />
  );
}
