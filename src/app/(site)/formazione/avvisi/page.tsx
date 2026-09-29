import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { getFormazioneAvvisi } from "@/lib/data";
import { getCurrentUser, canEditFormazioneAvviso } from "@/lib/auth";
import { formatData } from "@/lib/format";
import { Allegati } from "@/components/ui/Allegati";
import { EditButton } from "@/components/ui/EditButton";

export const dynamic = "force-dynamic";

// Bacheca aperta a tutti: chiunque sia loggato vede il tasto "+ Aggiungi" e può
// pubblicare, senza bisogno di un permesso dedicato (a differenza delle
// Comunicazioni, da cui questa sezione è stata scorporata). Modifica/eliminazione
// restano riservate a chi ha creato l'avviso (o all'admin), vedi
// canEditFormazioneAvviso in lib/auth.ts.
export default async function FormazioneAvvisiPage() {
  const [avvisi, user] = await Promise.all([getFormazioneAvvisi(), getCurrentUser()]);

  return (
    <section>
      <header className="page-header">
        <Link href={ROUTES.formazione.path} className="help">← Formazione</Link>
        <div className="page-header__row">
          <div>
            <h1>{ROUTES.formazioneAvvisi.label}</h1>
            <p>{ROUTES.formazioneAvvisi.description}</p>
          </div>
          {user && (
            <Link href="/formazione/avvisi/nuovo" className="btn btn--primary">
              + Aggiungi
            </Link>
          )}
        </div>
      </header>

      {avvisi.length === 0 ? (
        <div className="card empty">Nessun avviso pubblicato ancora.</div>
      ) : (
        <ul className="comm-list">
          {avvisi.map((a) => {
            const puoModificare = !!user && canEditFormazioneAvviso(user, a);
            return (
              <li key={a.id} className={`card comm-item${puoModificare ? " has-fab" : ""}`}>
                {puoModificare && (
                  <EditButton href={`/formazione/avvisi/nuovo?edit=${a.id}`} variant="fab" />
                )}
                <h2 className="comm-item__title">{a.titolo}</h2>
                <p style={{ whiteSpace: "pre-wrap", color: "var(--muted)" }}>{a.descrizione}</p>
                <Allegati allegati={a.allegati} />
                <div className="comm-item__meta">
                  <strong>{a.autore}</strong>
                  <span>·</span>
                  <time dateTime={a.creatoIl}>{formatData(a.creatoIl)}</time>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
