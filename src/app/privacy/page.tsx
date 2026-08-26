import type { Metadata } from "next";
import { CONTACT_LABEL, CONTACT_URL, LegalPage, Section } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Règles de confidentialité",
  description: "Quelles données GTA6MAP collecte, pourquoi, où elles sont stockées et comment les supprimer.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Règles de confidentialité" updated="25 août 2026">
      <p>
        GTA6MAP (« le Site ») est une carte interactive non officielle créée par des fans. Cette page décrit les
        données que nous traitons lorsque vous utilisez le Site, avec ou sans compte. Nous ne vendons aucune donnée,
        n&apos;affichons aucune publicité et ne suivons pas votre navigation à des fins commerciales.
      </p>

      <Section title="1. Utilisation sans compte">
        <p>
          Sans compte, votre progression (lieux marqués comme trouvés, notes, marqueurs personnalisés), vos filtres et la
          position de la carte sont enregistrés <strong>uniquement dans votre navigateur</strong> (localStorage). Ces
          données ne quittent pas votre appareil et disparaissent si vous effacez les données du site.
        </p>
      </Section>

      <Section title="2. Données collectées avec un compte">
        <p>Si vous créez un compte, nous stockons :</p>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Identifiants</strong> : adresse e-mail et, si vous choisissez ce mode, un mot de passe (haché, jamais lisible).</li>
          <li><strong>Profil</strong> : pseudo et, le cas échéant, l&apos;avatar fourni par Google.</li>
          <li><strong>Progression</strong> : lieux trouvés, dates, notes personnelles et marqueurs que vous créez.</li>
          <li><strong>Données techniques</strong> : jetons de session (cookies), horodatages de connexion, gérés par notre prestataire d&apos;authentification.</li>
        </ul>
        <p>Ces données servent exclusivement à vous authentifier et à synchroniser votre progression entre vos appareils.</p>
      </Section>

      <Section title="3. Connexion avec Google">
        <p>
          Si vous utilisez « Continuer avec Google », Google nous transmet votre adresse e-mail, votre nom d&apos;affichage
          et votre photo de profil (portée <code>openid email profile</code>). Nous n&apos;accédons à aucune autre donnée de
          votre compte Google (ni contacts, ni Drive, ni agenda) et n&apos;écrivons rien dans celui-ci. L&apos;utilisation des
          informations reçues de Google respecte la{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-accent-2 hover:underline">
            Google API Services User Data Policy
          </a>
          , y compris les exigences d&apos;usage limité.
        </p>
      </Section>

      <Section title="4. Hébergement et sous-traitants">
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Supabase</strong> (base de données et authentification) — serveurs situés dans l&apos;Union européenne.</li>
          <li><strong>Vercel</strong> (hébergement du site et réseau de diffusion).</li>
          <li><strong>Google</strong> (uniquement si vous choisissez la connexion Google).</li>
        </ul>
        <p>Aucun autre tiers ne reçoit vos données personnelles.</p>
      </Section>

      <Section title="5. Cookies">
        <p>
          Le Site n&apos;utilise que des cookies strictement nécessaires : la session d&apos;authentification lorsque vous êtes
          connecté. Aucun cookie publicitaire ni de mesure d&apos;audience tierce n&apos;est déposé.
        </p>
      </Section>

      <Section title="6. Durée de conservation">
        <p>
          Vos données de compte sont conservées tant que le compte existe. Les jetons de session expirent
          automatiquement. Les données locales (sans compte) restent sur votre appareil jusqu&apos;à ce que vous les effaciez.
        </p>
      </Section>

      <Section title="7. Vos droits et suppression du compte">
        <p>
          Vous pouvez à tout moment consulter et modifier votre pseudo depuis la page « Mon compte », effacer votre
          progression (bouton « Réinitialiser »), ou demander la <strong>suppression complète de votre compte</strong> et
          de toutes les données associées via {" "}
          <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" className="text-accent-2 hover:underline">{CONTACT_LABEL}</a>
          . La suppression est effectuée sous 30 jours. Conformément au RGPD, vous disposez également d&apos;un droit
          d&apos;accès, de rectification, de portabilité et d&apos;opposition.
        </p>
      </Section>

      <Section title="8. Contenus tiers">
        <p>
          Les données cartographiques proviennent de projets communautaires (gtadb.org, gtamaplib, GTA Wiki) et les
          visuels de jeu appartiennent à Rockstar Games / Take-Two Interactive. Le Site n&apos;est ni affilié ni approuvé par
          Rockstar Games. Les images chargées depuis ces sources peuvent transmettre votre adresse IP à leurs
          hébergeurs, comme pour toute image web.
        </p>
      </Section>

      <Section title="9. Modifications et contact">
        <p>
          Cette politique peut évoluer ; la date en haut de page indique la dernière version. Pour toute question :{" "}
          <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" className="text-accent-2 hover:underline">{CONTACT_LABEL}</a>.
        </p>
      </Section>
    </LegalPage>
  );
}
