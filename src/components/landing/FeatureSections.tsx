import { Camera, CheckCircle2, Layers, Search } from "@/components/ui/icons";
import type { LandingStats } from "@/lib/landing-stats";

/** Trois arguments produit, chacun adossé à un chiffre réel du jeu de données. */
export function FeatureSections({ stats }: { stats: LandingStats }) {
  const features = [
    {
      icon: Camera,
      title: "Les trailers, au mètre près",
      body: `Chaque plan des trailers officiels est replacé sur la carte avec l'orientation exacte de la caméra — un cône indique où elle regardait. ${stats.cameras} positions couvrant ${stats.mediaSources.map((s) => s.label.toLowerCase()).join(", ")}.`,
      metric: `${stats.cameras} plans`,
    },
    {
      icon: Layers,
      title: "Filtrer sans se noyer",
      body: `${stats.categories} catégories activables une par une, groupées par nature. Masquez ce que vous avez déjà trouvé et il ne reste que le travail qui compte.`,
      metric: `${stats.categories} catégories`,
    },
    {
      icon: CheckCircle2,
      title: "Votre progression vous suit",
      body: "Cochez un lieu et c'est enregistré. En local par défaut, synchronisé sur tous vos appareils si vous créez un compte — jamais l'un au détriment de l'autre.",
      metric: "Local & synchronisé",
    },
    {
      icon: Search,
      title: "Trouver, pas chercher",
      body: `Recherche instantanée sur les ${stats.total.toLocaleString("fr-FR")} lieux, accessible au clavier (Ctrl + K). Tapez trois lettres, la carte vole jusqu'au point.`,
      metric: "Ctrl + K",
    },
  ];

  return (
    <section className="relative mx-auto max-w-6xl px-5 py-20 sm:py-28">
      <div className="vi-rule mb-16" />
      <ul className="grid gap-x-10 gap-y-14 sm:grid-cols-2">
        {features.map(({ icon: Icon, title, body, metric }, i) => (
          <li key={title} className="vi-reveal" data-reveal-delay={(i % 2) * 0.09}>
            <Icon className="h-6 w-6 text-accent" />
            <h3 className="rs-title mt-5 text-xl text-foreground">{title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
            <p className="vi-kicker mt-4 text-muted-2">{metric}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
