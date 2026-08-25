import type { LandingStats } from "@/lib/landing-stats";

/** Bandeau de chiffres — tous dérivés du jeu de données réel, aucun en dur. */
export function StatsBand({ stats }: { stats: LandingStats }) {
  const items = [
    { value: stats.landmarks, label: "Lieux identifiés", hint: "bâtiments, commerces, points d'intérêt" },
    { value: stats.cameras, label: "Plans géolocalisés", hint: "trailers & screenshots officiels" },
    { value: stats.categories, label: "Catégories", hint: "filtrables une par une" },
    { value: stats.photos, label: "Photos", hint: "captures in-game et lieux réels" },
  ];

  return (
    <section id="chiffres" className="relative mx-auto max-w-6xl px-5 py-20 sm:py-28">
      <div className="vi-rule mb-14" />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4">
        {items.map((item, i) => (
          <div key={item.label} className="vi-reveal" data-reveal-delay={i * 0.08}>
            <dt className="sr-only">{item.label}</dt>
            <dd>
              <span className="vi-display block text-[clamp(2.75rem,7vw,4.5rem)] text-gradient-vi vi-num">
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
