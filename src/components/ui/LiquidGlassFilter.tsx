/**
 * Filtre de réfraction du verre, monté une seule fois par la mise en page.
 *
 * Repris de `designali-in/liquid-glass-button` (21st.dev) : un bruit fractal
 * déplace le fond avant qu'il ne soit flouté, ce qui donne le glissement de
 * matière derrière la surface. Les classes l'appellent en
 * `backdrop-filter: url("#rs-liquid-glass")` (cf. `.rs-liquid`).
 *
 * Un seul `<defs>` pour toute l'application : un filtre SVG est global au
 * document, le répéter par composant n'ajouterait que des nœuds.
 */
export function LiquidGlassFilter() {
  return (
    <svg aria-hidden className="pointer-events-none absolute h-0 w-0" focusable="false">
      <defs>
        <filter id="rs-liquid-glass" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.05 0.05" numOctaves={1} seed={1} result="turbulence" />
          <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
          {/* `scale` réduit par rapport à l'original (70) : à cette amplitude, du
              texte lu à travers la surface devenait illisible. */}
          <feDisplacementMap in="SourceGraphic" in2="blurredNoise" scale="24" xChannelSelector="R" yChannelSelector="B" result="displaced" />
          <feGaussianBlur in="displaced" stdDeviation="1.5" />
        </filter>
      </defs>
    </svg>
  );
}
