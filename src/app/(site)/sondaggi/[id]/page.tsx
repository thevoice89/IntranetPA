import Link from "next/link";
import { notFound } from "next/navigation";
import { getSondaggio } from "@/lib/data";
import { getCurrentUser, canManageSondaggioItem } from "@/lib/auth";
import { EditButton } from "@/components/ui/EditButton";
import { compilaSondaggio } from "@/app/(site)/sondaggi/actions";
import type { SondaggioCampo } from "@/types";

export const dynamic = "force-dynamic";

const ERRORI: Record<string, string> = {
  non_disponibile: "Questo sondaggio non è (più) disponibile.",
  campi_obbligatori: "Compila tutte le domande obbligatorie prima di inviare.",
  file_troppo_grande: "Il file allegato supera la dimensione massima consentita (8 MB).",
};

// Stesso rendering di CampoInput in (site)/moduli/[id]/page.tsx: stessi tipi di
// campo (TipoCampoModulo), stessa convenzione di nome campo (`campo_<id>`).
function CampoInput({ campo }: { campo: SondaggioCampo }) {
  const name = `campo_${campo.id}`;

  switch (campo.tipo) {
    case "testo_lungo":
      return <textarea id={name} name={name} className="textarea" rows={4} required={campo.obbligatorio} />;
    case "numero":
      return <input id={name} name={name} type="number" className="input" required={campo.obbligatorio} />;
    case "data":
      return <input id={name} name={name} type="date" className="input" required={campo.obbligatorio} />;
    case "email":
      return <input id={name} name={name} type="email" className="input" required={campo.obbligatorio} />;
    case "telefono":
      return <input id={name} name={name} type="tel" className="input" required={campo.obbligatorio} />;
    case "select":
      return (
        <select id={name} name={name} className="select" required={campo.obbligatorio} defaultValue="">
          <option value="" disabled>
            Seleziona…
          </option>
          {campo.opzioni.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
    case "radio":
      return (
        <div>
          {campo.opzioni.map((o) => (
            <div key={o} className="field field--check">
              <input
                id={`${name}-${o}`}
                name={name}
                type="radio"
                value={o}
                required={campo.obbligatorio}
              />
              <label htmlFor={`${name}-${o}`} style={{ color: "var(--text)" }}>{o}</label>
            </div>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <div className="field field--check">
          <input id={name} name={name} type="checkbox" />
          <label htmlFor={name} style={{ color: "var(--text)" }}>{campo.etichetta}</label>
        </div>
      );
    case "file":
      return <input id={name} name={name} type="file" className="input" required={campo.obbligatorio} />;
    case "testo":
    default:
      return <input id={name} name={name} type="text" className="input" required={campo.obbligatorio} />;
  }
}

export default async function SondaggioDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const sondaggio = await getSondaggio(id);
  if (!sondaggio || !sondaggio.pubblicato) notFound();

  const { ok, error } = await searchParams;
  const user = await getCurrentUser();
  const puoModificare = user ? canManageSondaggioItem(user, sondaggio) : false;

  return (
    <section>
      <header className="page-header">
        <Link href="/sondaggi" className="help">← Sondaggi</Link>
        <div className="page-header__row">
          <h1>{sondaggio.titolo}</h1>
          {puoModificare && <EditButton href={`/admin/sondaggi?edit=${sondaggio.id}`} />}
        </div>
      </header>

      {sondaggio.descrizione && (
        <div className="card" style={{ padding: "1.2rem", marginBottom: "1.25rem" }}>
          <div className="rich-text" dangerouslySetInnerHTML={{ __html: sondaggio.descrizione }} />
        </div>
      )}

      <div className="card" style={{ padding: "1.5rem", maxWidth: 640 }}>
        {ok && <div className="notice notice--ok">Grazie! La tua risposta è stata inviata.</div>}
        {error && <div className="alert">{ERRORI[error] ?? "Operazione non valida."}</div>}

        {sondaggio.campi.length === 0 ? (
          <p className="help">Questo sondaggio non ha ancora nessuna domanda configurata.</p>
        ) : (
          <form action={compilaSondaggio} className="form">
            <input type="hidden" name="sondaggioId" value={sondaggio.id} />

            {sondaggio.campi.map((campo) =>
              campo.tipo === "testo_statico" ? (
                <div
                  key={campo.id}
                  className="rich-text"
                  dangerouslySetInnerHTML={{ __html: campo.etichetta }}
                />
              ) : (
                <div className="field" key={campo.id}>
                  {campo.tipo !== "checkbox" && (
                    <label htmlFor={`campo_${campo.id}`}>
                      {campo.etichetta} {campo.obbligatorio && <span aria-hidden>*</span>}
                    </label>
                  )}
                  <CampoInput campo={campo} />
                </div>
              )
            )}

            <div>
              <button type="submit" className="btn btn--primary">Invia</button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
