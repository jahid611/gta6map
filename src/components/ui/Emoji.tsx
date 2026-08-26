/**
 * Emoji rendu en image, identique sur toutes les plateformes.
 *
 * Jeu Fluent Emoji 3D de Microsoft (licence MIT) : parmi les jeux libres, c'est
 * celui dont le modelé rond et brillant se rapproche le plus de celui d'Apple.
 * L'artwork d'Apple lui-même ne peut pas être hébergé, quel qu'en soit le
 * format — PNG ou SVG, c'est son dessin qui est protégé, et sa licence de fonte
 * n'autorise ni la redistribution ni l'usage web.
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
      src={`/emoji/fluent/${code}.png`}
      alt={char}
      // Servis tels quels : ~35 ko chacun, chargés à la demande et mis en cache
      // par le navigateur. Huit fichiers en tout, l'optimiseur d'images n'aurait
      // rien à y gagner.
      className={`inline-block align-[-0.15em] ${className}`}
      draggable={false}
      loading="lazy"
    />
  );
}
