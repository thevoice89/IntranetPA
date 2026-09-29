import Link from "next/link";
import type { Comunicazione } from "@/types";
import { formatData, mostraInEvidenza } from "@/lib/format";
import { Allegati } from "@/components/ui/Allegati";
import { EditButton } from "@/components/ui/EditButton";

// Elemento di lista per una comunicazione (ufficiale o non ufficiale).
// Se `editHref` è valorizzato (utente loggato con permesso), mostra la matita.
export function ComunicazioneCard({
  comunicazione,
  editHref,
}: {
  comunicazione: Comunicazione;
  editHref?: string;
}) {
  const { id, tipo, titolo, estratto, autore, data, categoria, allegati, sondaggioId, sondaggioPubblicato } =
    comunicazione;
  const href = `/comunicazioni/${id}`;

  return (
    <li className={`card comm-item${editHref ? " has-fab" : ""}`}>
      {editHref && <EditButton href={editHref} variant="fab" />}
      <div className="comm-item__top">
        {/* Le non ufficiali non indicano un ufficio: sono bacheca informale aperta a
            tutti, non organizzata per struttura comunale (vedi (site)/comunicazioni-non-ufficiali/nuova). */}
        {tipo === "ufficiale" && <span className="badge">{categoria}</span>}
        {tipo === "rsu" && <span className="badge badge--rsu">RSU</span>}
        {tipo === "sicurezza" && <span className="badge badge--sicurezza">Sicurezza</span>}
        {tipo === "eventi" && <span className="badge badge--eventi">Eventi</span>}
        {tipo === "formazione" && <span className="badge badge--formazione">Notizie Formazione</span>}
        {mostraInEvidenza(comunicazione) && <span className="badge badge--highlight">In evidenza</span>}
        {sondaggioId && sondaggioPubblicato && <span className="badge">📊 Sondaggio</span>}
      </div>
      <h2 className="comm-item__title">
        <Link href={href} className="comm-item__link">{titolo}</Link>
      </h2>
      <p className="comm-item__excerpt">{estratto}</p>
      <Allegati allegati={allegati} />
      <div className="comm-item__meta">
        <strong>{autore}</strong>
        <span>·</span>
        <time dateTime={data}>{formatData(data)}</time>
        <Link href={href} className="comm-item__more">Leggi tutto →</Link>
      </div>
    </li>
  );
}
