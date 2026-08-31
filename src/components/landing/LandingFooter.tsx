import Link from "next/link";

/**
 * Pied de page. Le disclaimer n'est pas décoratif : le site emploie des marques
 * et un wordmark appartenant à Rockstar Games / Take-Two, il faut donc dire
 * explicitement qu'il s'agit d'un projet de fan sans affiliation.
 */
export function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="rs-title text-sm text-foreground">GTA VI Map</p>
            <p className="mt-1 text-xs text-muted-2">Carte interactive de Leonida &amp; Vice City</p>
          </div>

          {/* `py-2.5` porte chaque lien à 44 px de haut : sans lui ils ne
              faisaient que 20 px, sous le seuil confortable au doigt. */}
          <nav aria-label="Liens de pied de page" className="-mx-3 flex flex-wrap text-sm text-muted">
            <Link href="/map" className="px-3 py-2.5 hover:text-foreground">
              La carte
            </Link>
            <Link href="/street" className="px-3 py-2.5 hover:text-foreground">
              Mode piéton
            </Link>
            <Link href="/galerie" className="px-3 py-2.5 hover:text-foreground">
              Galerie
            </Link>
            <a href="#regions" className="px-3 py-2.5 hover:text-foreground">
              Régions
            </a>
            <a
              href="https://gta.wiki"
              target="_blank"
              rel="noreferrer noopener"
              className="px-3 py-2.5 hover:text-foreground"
            >
              GTA Wiki
            </a>
          </nav>
        </div>

        <p className="mt-10 max-w-3xl text-xs leading-relaxed text-muted-2">
          Projet de fan, sans but lucratif et sans aucune affiliation avec Rockstar Games ou Take-Two Interactive.
          « Grand Theft Auto », « GTA » et le logo GTA VI sont des marques de Take-Two Interactive Software, Inc.
          Les données de lieux proviennent de la communauté (gtadb.org, gtamaplib, GTA Wiki) et les extraits
          encyclopédiques de GTA Wiki. Interface composée en Archivo (OFL) : la police officielle du jeu,
          GTAArtDeco, est sous licence exclusive Rockstar et n&apos;est pas redistribuée ici. Icônes par{" "}
          <a
            href="https://www.flaticon.com/uicons"
            target="_blank"
            rel="noreferrer noopener"
            className="underline decoration-dotted underline-offset-2 hover:text-foreground"
          >
            Flaticon
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
