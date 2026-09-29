import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { getCurrentUser, canVedereFormazioneTutti } from "@/lib/auth";
import { sottopostiDi } from "@/lib/gerarchia";

export const dynamic = "force-dynamic";

function CardSezione({
  href,
  icon,
  titolo,
  descrizione,
}: {
  href: string;
  icon: string;
  titolo: string;
  descrizione: string;
}) {
  return (
    <Link href={href} className="card service-card">
      <span className="service-card__name">
        {icon} {titolo}
      </span>
      <span className="service-card__desc">{descrizione}</span>
    </Link>
  );
}

export default async function FormazionePage() {
  const user = await getCurrentUser();
  const isAdmin = user?.ruolo === "admin";
  const vedeTutti = !!user && (isAdmin || canVedereFormazioneTutti(user));
  const eResponsabile =
    !vedeTutti && user?.contattoId ? (await sottopostiDi(user.contattoId)).length > 0 : false;
  const mostraReportResponsabili = vedeTutti || eResponsabile;

  return (
    <section>
      <header className="page-header">
        <h1>{ROUTES.formazione.label}</h1>
        <p>{ROUTES.formazione.description}</p>
      </header>

      <div className="grid">
        <CardSezione
          href={ROUTES.formazioneAttivita.path}
          icon="📋"
          titolo={ROUTES.formazioneAttivita.label}
          descrizione={
            user
              ? "Registra i corsi seguiti, le ore e gli attestati ricevuti."
              : "Richiede il login: registra i corsi seguiti, le ore e gli attestati."
          }
        />
        <CardSezione
          href={ROUTES.formazioneAvvisi.path}
          icon="📣"
          titolo={ROUTES.formazioneAvvisi.label}
          descrizione="Iniziative interne ed esterne, materiali dei corsi svolti: aperta a tutti."
        />
        <CardSezione
          href={ROUTES.formazioneColleghi.path}
          icon="🧑‍🏫"
          titolo={ROUTES.formazioneColleghi.label}
          descrizione="Pillole formative e competenze condivise dai colleghi."
        />
        {mostraReportResponsabili && (
          <CardSezione
            href="/admin/formazione"
            icon="📊"
            titolo="Report attività formative"
            descrizione={
              vedeTutti
                ? "Attività formative di tutti i dipendenti."
                : "Attività formative dei tuoi collaboratori."
            }
          />
        )}
      </div>
    </section>
  );
}
