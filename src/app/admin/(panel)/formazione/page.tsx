import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, canVedereFormazioneTutti, canEsportareFormazione } from "@/lib/auth";
import { getContatti, getFormazioneAttivitaPerContatti, getFormazioneAttivita, listUffici } from "@/lib/data";
import { sottopostiDi } from "@/lib/gerarchia";
import { antenatiDi, espandiConDiscendenti, elencoIndentato } from "@/lib/uffici-tree";
import { FiltroUfficio } from "@/components/admin/FiltroUfficio";
import { MODALITA_FRUIZIONE, AREE_TEMATICHE } from "@/lib/formazione-opzioni";
import { salvaAttivitaFormazione, rimuoviAttivitaFormazione } from "@/app/(site)/formazione/le-mie-attivita/actions";
import CertificazioneAttestatoField from "@/app/(site)/formazione/le-mie-attivita/CertificazioneAttestatoField";
import type { Contatto, FormazioneAttivita } from "@/types";

export const dynamic = "force-dynamic";

const ERRORI: Record<string, string> = {
  descrizione: "Indica la descrizione del percorso formativo.",
  campi: "Compila tutti i campi obbligatori (tutti tranne l'area tematica).",
  permesso: "Operazione non consentita.",
  attestato: "Carica l'attestato: è obbligatorio quando spunti la certificazione delle competenze.",
};

interface Gruppo {
  nome: string;
  oreSvolte: number;
  attivita: FormazioneAttivita[];
}

// Vista dei responsabili sulle attività formative dei propri collaboratori:
// sola lettura, l'inserimento resta sempre auto-dichiarato da ciascun
// dipendente in (site)/formazione/le-mie-attivita. Chi ha
// canVedereFormazioneTutti/admin vede tutti i dipendenti E può anche
// correggerne le attività (Modifica/Elimina), non solo consultarle.
export default async function AdminFormazione({
  searchParams,
}: {
  searchParams: Promise<{ ufficio?: string; edit?: string; error?: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.ruolo === "admin";
  // Accesso pieno (permesso piatto, non legato alla gerarchia responsabili):
  // vede e può esportare i dati di TUTTI i dipendenti.
  const vedeTutti = isAdmin || canVedereFormazioneTutti(user) || canEsportareFormazione(user);
  // Sottoinsieme di vedeTutti: chi ha SOLO canEsportareFormazione resta
  // un'utenza dedicata all'estrazione dati (vedi canEsportareFormazione in
  // lib/auth.ts), senza diritto di modifica — quello è riservato a chi ha
  // davvero il permesso "vede tutte le attività formative" (o admin). Va
  // ricontrollato anche lato server in requireAutorizzazioneScrittura
  // (le-mie-attivita/actions.ts): questo flag qui condiziona solo la UI.
  const puoModificare = isAdmin || canVedereFormazioneTutti(user);
  const { edit, error } = await searchParams;
  // getFormazioneAttivita, non il gruppo già filtrato per ufficio, così il
  // link "Modifica" funziona anche quando il filtro ufficio nasconde il record.
  const inModifica = puoModificare && edit ? await getFormazioneAttivita(edit) : null;

  let collaboratori: Contatto[];
  if (vedeTutti) {
    collaboratori = await getContatti();
  } else {
    if (!user.contattoId) redirect("/admin");
    collaboratori = await sottopostiDi(user.contattoId);
    if (collaboratori.length === 0) redirect("/admin");
  }

  // Chiunque arrivi qui ha già qualcosa da vedere (accesso pieno, o
  // collaboratori propri — altrimenti si è già stati rediretti sopra): la
  // route /api/formazione-esporta rifà lo stesso calcolo e, per chi non ha
  // accesso pieno, limita il file ai soli propri sottoposti.
  const puoEsportare = true;

  // Filtro per ufficio, stesso pattern di /admin/presenze: opzioni limitate al
  // ramo dell'organigramma davvero popolato dai collaboratori visibili. Di
  // default nessun filtro: si vede tutto.
  const uffici = await listUffici();
  const nodiRilevanti = new Set<string>();
  for (const c of collaboratori) {
    for (const u of c.uffici) {
      for (const id of antenatiDi(u.id, uffici)) nodiRilevanti.add(id);
    }
  }
  const opzioniUfficio = elencoIndentato(uffici).filter((u) => nodiRilevanti.has(u.id));

  const { ufficio: ufficioParam } = await searchParams;
  let contattoIdsVisibili: string[] | null = vedeTutti ? null : collaboratori.map((c) => c.id);
  if (ufficioParam) {
    const idsRamo = new Set(espandiConDiscendenti([ufficioParam], uffici));
    contattoIdsVisibili = collaboratori.filter((c) => c.uffici.some((u) => idsRamo.has(u.id))).map((c) => c.id);
  }

  const attivita = await getFormazioneAttivitaPerContatti(contattoIdsVisibili);

  const perPersona = new Map<string, Gruppo>();
  for (const a of attivita) {
    const g = perPersona.get(a.contattoId) ?? { nome: a.contattoNome ?? "—", oreSvolte: 0, attivita: [] };
    g.oreSvolte += a.oreSvolte;
    g.attivita.push(a);
    perPersona.set(a.contattoId, g);
  }
  const gruppi = [...perPersona.values()].sort((a, b) => a.nome.localeCompare(b.nome, "it"));

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>Formazione</h1>
            <p>
              {vedeTutti
                ? "Attività formative di tutti i dipendenti"
                : "Attività formative dei tuoi collaboratori"}{" "}
              · {attivita.length} corsi · {gruppi.length} persone
            </p>
          </div>
          {puoEsportare && (
            <a href="/api/formazione-esporta" className="btn btn--primary">
              ⬇️ Esporta Excel
            </a>
          )}
        </div>
      </header>

      {error && <div className="alert">{ERRORI[error] ?? "Operazione non valida."}</div>}

      {inModifica && (
        <div className="card" style={{ padding: "1.5rem", marginBottom: "1.25rem" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "1.1rem" }}>
            Modifica corso di {inModifica.contattoNome ?? "—"}
          </h2>
          <form key={inModifica.id} action={salvaAttivitaFormazione} className="form">
            <input type="hidden" name="id" value={inModifica.id} />
            <input type="hidden" name="redirectTo" value="/admin/formazione" />
            <div className="field">
              <label htmlFor="descrizionePercorso">Descrizione percorso formativo</label>
              <textarea
                id="descrizionePercorso"
                name="descrizionePercorso"
                className="textarea"
                required
                rows={2}
                defaultValue={inModifica.descrizionePercorso}
              />
            </div>
            <div className="field--row">
              <div className="field">
                <label htmlFor="enteErogatore">Ente erogante</label>
                <input
                  id="enteErogatore"
                  name="enteErogatore"
                  className="input"
                  required
                  defaultValue={inModifica.enteErogatore}
                />
              </div>
              <div className="field">
                <label htmlFor="dataCorso">Data corso</label>
                <input
                  id="dataCorso"
                  name="dataCorso"
                  type="date"
                  className="input"
                  required
                  defaultValue={inModifica.dataCorso}
                />
              </div>
            </div>
            <div className="field--row">
              <div className="field">
                <label htmlFor="orePreviste">Ore previste</label>
                <input
                  id="orePreviste"
                  name="orePreviste"
                  type="number"
                  min="0"
                  step="0.5"
                  className="input"
                  required
                  defaultValue={inModifica.orePreviste}
                />
              </div>
              <div className="field">
                <label htmlFor="oreSvolte">Ore svolte</label>
                <input
                  id="oreSvolte"
                  name="oreSvolte"
                  type="number"
                  min="0"
                  step="0.5"
                  className="input"
                  required
                  defaultValue={inModifica.oreSvolte}
                />
              </div>
            </div>
            <div className="field--row">
              <div className="field">
                <label htmlFor="modalitaFruizione">Modalità di fruizione</label>
                <select
                  id="modalitaFruizione"
                  name="modalitaFruizione"
                  className="select"
                  required
                  defaultValue={inModifica.modalitaFruizione}
                >
                  <option value="">— seleziona —</option>
                  {MODALITA_FRUIZIONE.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="areaTematica">Area tematica (facoltativa)</label>
                <select
                  id="areaTematica"
                  name="areaTematica"
                  className="select"
                  defaultValue={inModifica.areaTematica}
                >
                  <option value="">— seleziona —</option>
                  {AREE_TEMATICHE.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <CertificazioneAttestatoField
              key={inModifica.id}
              defaultChecked={inModifica.certificazioneCompetenze}
              attestatoUrl={inModifica.attestatoUrl}
              attestatoNomeOriginale={inModifica.attestatoNomeOriginale}
            />
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button type="submit" className="btn btn--primary">
                Salva modifiche
              </button>
              <Link href="/admin/formazione" className="btn btn--ghost">
                Annulla
              </Link>
            </div>
          </form>
        </div>
      )}

      {opzioniUfficio.length > 1 && <FiltroUfficio opzioni={opzioniUfficio} />}

      {gruppi.length === 0 ? (
        <div className="card empty">Nessuna attività registrata.</div>
      ) : (
        gruppi.map((g) => (
          <details
            key={g.nome}
            className="card"
            style={{ padding: "1rem 1.25rem", marginBottom: "0.75rem" }}
          >
            <summary
              style={{
                cursor: "pointer",
                fontWeight: 600,
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <span>{g.nome}</span>
              <span className="badge">
                {g.attivita.length} corso{g.attivita.length === 1 ? "" : "i"} · {g.oreSvolte} ore svolte
              </span>
            </summary>
            <ul className="admin-list" style={{ marginTop: "0.9rem" }}>
              {g.attivita.map((a) => (
                <li
                  key={a.id}
                  className="card admin-row"
                  style={{ boxShadow: "none", border: "1px solid var(--border)" }}
                >
                  <div className="admin-row__main">
                    <div className="admin-row__title">{a.descrizionePercorso}</div>
                    <div className="admin-row__sub">
                      {a.enteErogatore && `${a.enteErogatore} · `}
                      {a.dataCorso} · {a.oreSvolte}/{a.orePreviste} ore
                      {a.modalitaFruizione && ` · ${a.modalitaFruizione}`}
                      {a.areaTematica && ` · ${a.areaTematica}`}
                      {a.certificazioneCompetenze && " · ✅ certificazione competenze"}
                    </div>
                  </div>
                  <div className="admin-row__actions">
                    {a.attestatoUrl && (
                      <a
                        href={a.attestatoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn--ghost btn--sm"
                      >
                        📎 Attestato
                      </a>
                    )}
                    {puoModificare && (
                      <>
                        <Link href={`/admin/formazione?edit=${a.id}`} className="btn btn--ghost btn--sm">
                          Modifica
                        </Link>
                        <form action={rimuoviAttivitaFormazione} className="inline-form">
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="redirectTo" value="/admin/formazione" />
                          <button type="submit" className="btn btn--danger btn--sm">
                            Elimina
                          </button>
                        </form>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        ))
      )}
    </section>
  );
}
