import type { Metadata } from "next";
import { CONTACT_LABEL, CONTACT_URL, LegalPage, Section } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description: "Conditions d'utilisation de GTA6MAP, carte interactive non officielle de Leonida & Vice City.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Conditions d'utilisation" updated="25 août 2026">
      <p>
        En utilisant GTA6MAP (« le Site »), vous acceptez les présentes conditions. Le Site est gratuit, sans
        publicité, et proposé « en l&apos;état » par des fans, à des fins d&apos;information et de divertissement.
      </p>

      <Section title="1. Projet non officiel">
        <p>
          GTA6MAP est un projet de fans <strong>indépendant</strong>. Il n&apos;est ni affilié, ni sponsorisé, ni
          approuvé par Rockstar Games, Take-Two Interactive ou leurs filiales. « Grand Theft Auto », « GTA », « Vice
          City », le logo VI et les visuels du jeu sont des marques et œuvres appartenant à leurs détenteurs respectifs,
          utilisés ici à titre descriptif et non commercial.
        </p>
      </Section>

      <Section title="2. Compte utilisateur">
        <ul className="list-disc space-y-1 pl-6">
          <li>La création d&apos;un compte est facultative : elle sert à synchroniser votre progression entre appareils.</li>
          <li>Vous êtes responsable de la confidentialité de vos identifiants et de l&apos;activité de votre compte.</li>
          <li>Un pseudo ne doit pas usurper l&apos;identité d&apos;autrui ni contenir de propos injurieux ; nous pouvons le modifier ou suspendre un compte en cas d&apos;abus.</li>
          <li>Vous pouvez supprimer votre compte à tout moment (voir les <a href="/privacy" className="text-accent-2 hover:underline">règles de confidentialité</a>).</li>
        </ul>
      </Section>

      <Section title="3. Usage autorisé">
        <p>
          Vous pouvez consulter le Site et l&apos;utiliser librement pour un usage personnel. Sont interdits : l&apos;extraction
          automatisée massive (scraping) des données ou images, toute tentative d&apos;accès non autorisé, la surcharge
          volontaire du service, et toute utilisation contraire à la loi.
        </p>
      </Section>

      <Section title="4. Contenus et sources">
        <p>
          Les données cartographiques sont issues de projets communautaires ouverts — {" "}
          <a href="https://map.gtadb.org" target="_blank" rel="noopener noreferrer" className="text-accent-2 hover:underline">gtadb.org</a>{" "}
          (domaine public),{" "}
          <a href="https://github.com/rolux/gtamaplib" target="_blank" rel="noopener noreferrer" className="text-accent-2 hover:underline">gtamaplib</a>{" "}
          (MIT),{" "}
          <a href="https://gta.wiki" target="_blank" rel="noopener noreferrer" className="text-accent-2 hover:underline">GTA Wiki</a>{" "}
          (CC BY-NC-SA 3.0). Les captures de trailers et screenshots officiels sont la propriété de Rockstar Games.
          Le code du Site est publié sur GitHub. Les informations sont fournies sans garantie d&apos;exactitude : la carte
          est reconstituée avant la sortie du jeu et évolue.
        </p>
      </Section>

      <Section title="5. Vos contributions">
        <p>
          Les notes et marqueurs que vous créez restent les vôtres et ne sont visibles que par vous. Vous vous engagez
          à n&apos;y stocker aucun contenu illicite.
        </p>
      </Section>

      <Section title="6. Disponibilité et responsabilité">
        <p>
          Le Site peut être modifié, interrompu ou arrêté à tout moment, sans préavis. Dans la limite permise par la
          loi, les auteurs du Site ne sauraient être tenus responsables des dommages directs ou indirects liés à son
          utilisation, ni de la perte de données de progression.
        </p>
      </Section>

      <Section title="7. Retrait de contenu">
        <p>
          Si vous êtes titulaire de droits sur un contenu affiché et souhaitez son retrait, contactez-nous via{" "}
          <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" className="text-accent-2 hover:underline">{CONTACT_LABEL}</a>
          {" "}: nous traiterons la demande rapidement.
        </p>
      </Section>

      <Section title="8. Droit applicable">
        <p>
          Les présentes conditions sont régies par le droit français. Toute modification sera signalée par la date de
          mise à jour en haut de cette page.
        </p>
      </Section>
    </LegalPage>
  );
}
