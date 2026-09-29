import Link from "next/link";
import { notFound } from "next/navigation";
import { getModulo, listUffici, getContatti } from "@/lib/data";
import { getCurrentUser, canManageModuloItem } from "@/lib/auth";
import { EditButton } from "@/components/ui/EditButton";
import { Allegati } from "@/components/ui/Allegati";
import { compilaModulo } from "@/app/(site)/moduli/actions";
import { CampoNomeAutocompletaServizio } from "@/components/ui/CampoNomeAutocompletaServizio";
import type { ModuloCampo } from "@/types";

export const dynamic = "force-dynamic";

const ERRORI: Record<string, string> = {
  non_disponibile: "Questo modulo non è (più) disponibile.",
  campi_obbligatori: "Compila tutti i campi obbligatori prima di inviare.",
  file_troppo_grande: "Il file allegato supera la dimensione massima consentita (8 MB).",
};

function CampoInput({ campo }: { campo: ModuloCampo }) {
  const name = `campo_${campo.id}`;

  switch (campo.tipo) {
    case "testo_lungo":
      return <textarea id={name} name={name} className="textarea" rows={4} required={campo.obbligatorio} />;
    case "numero":
      return <input id={name} name={name} type="number" className="input" required={campo.obbligatorio} />;
    case "data":
      return <input id={name} name={name} type="date" className="input" required={campo.obbligatorio} />;
    case "ora":
      return <input id={name} name={name} type="time" className="input" required={campo.obbligatorio} />;
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

export default async function ModuloDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const modulo = await getModulo(id);
  if (!modulo || !modulo.pubblicato) notFound();

  const { ok, error } = await searchParams;
  const user = await getCurrentUser();
  const puoModificare = user ? canManageModuloItem(user, modulo, await listUffici()) : false;

  // Autocompilazione "Servizio di assegnazione" alla scelta del nome (vedi
  // Modulo Missione): stessa convenzione di trovaNomeCompilatore() in
  // lib/modulo-pdf.ts (campo il cui nome inizia per "Nome e cognome"), così
  // qualunque altro modulo che adotti le stesse due etichette la eredita
  // gratis, senza bisogno di un legame esplicito nello schema di ModuloCampo.
  const campoNomeCompilatore = modulo.campi.find(
    (c) => c.tipo === "testo" && /^nome e cognome/i.test(c.etichetta)
  );
  const campoServizio = modulo.campi.find(
    (c) => c.tipo === "select" && c.etichetta === "Servizio di assegnazione"
  );
  const autocompilaServizio = Boolean(campoNomeCompilatore && campoServizio);
  const contatti = autocompilaServizio ? await getContatti() : [];

  return (
    <section>
      <header className="page-header">
        <Link href="/moduli" className="help">← Moduli</Link>
        <div className="page-header__row">
          <h1>{modulo.titolo}</h1>
          {puoModificare && <EditButton href={`/admin/moduli?edit=${modulo.id}`} />}
        </div>
        <p>
          <span className="badge">{modulo.ufficioNome}</span>
        </p>
      </header>

      {modulo.descrizione && (
        <div className="card" style={{ padding: "1.2rem", marginBottom: "1.25rem" }}>
          <div className="rich-text" dangerouslySetInnerHTML={{ __html: modulo.descrizione }} />
        </div>
      )}

      {modulo.allegati && modulo.allegati.length > 0 && (
        <div className="card" style={{ padding: "1.2rem", marginBottom: "1.25rem" }}>
          <strong style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            {modulo.tipo === "documento" ? "Scarica" : "Allegati"}
          </strong>
          <Allegati allegati={modulo.allegati} />
        </div>
      )}

      {(modulo.tipo === "form" || modulo.tipo === "pdf") && (
        <div className="card" style={{ padding: "1.5rem" }}>
          {modulo.tipo === "pdf" && (
            <div className="notice" style={{ marginBottom: "1rem" }}>
              Compilando e scaricando il PDF, i dati inseriti non vengono salvati sull&apos;Intranet:
              nessuna copia resta all&apos;ufficio {modulo.ufficioNome}. Consegna tu il PDF compilato
              (firmato, se richiesto) secondo le modalità indicate.
            </div>
          )}
          {ok && (
            <div className="notice notice--ok">
              Grazie! Il modulo è stato inviato all&apos;ufficio {modulo.ufficioNome}.
            </div>
          )}
          {error && <div className="alert">{ERRORI[error] ?? "Operazione non valida."}</div>}

          {modulo.campi.length === 0 ? (
            <p className="help">Questo modulo non ha ancora nessun campo configurato.</p>
          ) : (
            <form
              action={modulo.tipo === "pdf" ? `/api/moduli-pdf/${modulo.id}` : compilaModulo}
              method={modulo.tipo === "pdf" ? "POST" : undefined}
              className="form"
            >
              <input type="hidden" name="moduloId" value={modulo.id} />

              {modulo.campi.map((campo) =>
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
                    {autocompilaServizio && campo.id === campoNomeCompilatore!.id ? (
                      <CampoNomeAutocompletaServizio
                        id={`campo_${campo.id}`}
                        name={`campo_${campo.id}`}
                        required={campo.obbligatorio}
                        contatti={contatti}
                        servizioSelectId={`campo_${campoServizio!.id}`}
                        opzioniServizio={campoServizio!.opzioni}
                      />
                    ) : (
                      <CampoInput campo={campo} />
                    )}
                  </div>
                )
              )}

              <div>
                <button type="submit" className="btn btn--primary">
                  {modulo.tipo === "pdf" ? "Scarica PDF compilato" : "Invia"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {modulo.tipo === "documento" && (!modulo.allegati || modulo.allegati.length === 0) && (
        <div className="card empty">Il documento non è ancora disponibile.</div>
      )}
    </section>
  );
}
