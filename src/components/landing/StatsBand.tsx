import Image from "next/image";
import type { LandingStats } from "@/lib/landing-stats";

/**
 * Bandeau de chiffres, d'après `uilayout.contact/stats-bold` (21st.dev) : un
 * chiffre dominant accompagné d'un visuel, puis une rangée de trois secondaires.
 *
 * Aucune dépendance dans l'original, aucune ici non plus — la mise en page fait
 * tout. Les valeurs restent dérivées du jeu de données réel, aucune en dur.
 *
 * Les nombres sont en rose Vice City et non en dégradé : un dégradé sur un
 * chiffre le rend plus difficile à lire qu'il ne l'embellit, la teinte variant
 * d'un chiffre à l'autre du même nombre.
 */
export function StatsBand({ stats }: { stats: LandingStats }) {
  const secondary = [
    { value: stats.cameras, label: "Plans géolocalisés", hint: "trailers & screenshots officiels" },
    { value: stats.categories, label: "Catégories", hint: "filtrables une par une" },
    { value: stats.photos, label: "Photos", hint: "captures in-game et lieux réels" },
  ];

  return (
    <section id="chiffres" className="relative mx-auto max-w-6xl px-5 py-20 sm:py-28">
      {/* Chiffre dominant + visuel */}
      <div className="vi-reveal flex flex-col gap-8 border-b border-border pb-10 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col items-baseline gap-x-6 gap-y-2 sm:flex-row">
          <span className="vi-display vi-num shrink-0 text-[clamp(3.5rem,11vw,7.5rem)] leading-none text-accent">
            {stats.landmarks.toLocaleString("fr-FR")}
          </span>
          <div className="max-w-xs">
            <h2 className="rs-title text-xl text-foreground">Lieux identifiés</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">bâtiments, commerces, points d&apos;intérêt</p>
          </div>
        </div>

        {stats.statsImage && (
          // Le cadre prend le format exact du visuel plutôt qu'une hauteur
          // imposée : c'est la seule façon de le montrer entier, `object-cover`
          // amputant forcément d'un côté dès que les deux rapports diffèrent.
          // La carte postale de Vice City fait 2 458 × 1 604, pas du 16:9 —
          // d'où un format porté par la donnée et non écrit ici.
          <div
            className="relative w-full shrink-0 overflow-hidden rounded-2xl md:w-[26rem]"
            style={{ aspectRatio: stats.statsImageRatio }}
          >
            <Image
              src={stats.statsImage}
              alt=""
              fill
              quality={92}
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
          </div>
        )}
      </div>

      {/* Les trois autres, à plat */}
      <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
        {secondary.map((item, i) => (
          <div key={item.label} className="vi-reveal" data-reveal-delay={i * 0.08}>
            <dt className="sr-only">{item.label}</dt>
            <dd>
              <span className="vi-display vi-num block text-[clamp(2.25rem,5vw,3.25rem)] leading-none text-accent">
                {item.value.toLocaleString("fr-FR")}
              </span>
              <span className="mt-3 block text-sm font-semibold text-foreground">{item.label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-2">{item.hint}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
