import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listUsers, getUserById, listUffici, getContatti } from "@/lib/data";
import { saveUser, removeUser } from "@/app/admin/actions";
import ContattoField from "@/components/ui/ContattoField";

export const dynamic = "force-dynamic";

const ERRORI: Record<string, string> = {
  username: "Lo username è obbligatorio.",
  self: "Non puoi eliminare il tuo stesso account.",
  lastadmin: "Deve esistere almeno un amministratore.",
};

export default async function AdminUtenti({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  const me = await requireAdmin();
  const { edit, error } = await searchParams;
  const utenti = await listUsers();
  const uffici = await listUffici();
  const contatti = await getContatti();
  const inModifica = edit ? await getUserById(edit) : null;
  const contattoCollegato = inModifica?.contattoId
    ? contatti.find((c) => c.id === inModifica.contattoId) ?? null
    : null;
  const contattiPerId = new Map(contatti.map((c) => [c.id, c]));

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>Utenti</h1>
            <p>Crea utenti e assegna ruoli e permessi.</p>
          </div>
          {edit && (
            <Link href="/admin/utenti" className="btn btn--ghost btn--sm">
              + Nuovo utente
            </Link>
          )}
        </div>
      </header>

      {error && <div className="alert">{ERRORI[error] ?? "Operazione non valida."}</div>}

      {/* --- Form crea/modifica --- */}
      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: "1.1rem" }}>
          {inModifica ? `Modifica: ${inModifica.username}` : "Nuovo utente"}
        </h2>
        <form key={inModifica?.id ?? "new"} action={saveUser} className="form">
          <input type="hidden" name="id" value={inModifica?.id ?? ""} />

          <ContattoField
            contatti={contatti}
            name="contattoId"
            label="Collegato al contatto rubrica (opzionale)"
            help="Se collegato, l'utente eredita nome e ufficio dal contatto: comparirà come «Ciao Nome Cognome» invece dello username. Nessun dato anagrafico viene duplicato."
            defaultContatto={contattoCollegato}
          />

          <div className="field--row">
            <div className="field">
              <label htmlFor="username">Username</label>
              <input id="username" name="username" className="input" required defaultValue={inModifica?.username ?? ""} />
            </div>
            <div className="field">
              <label htmlFor="password">
                Password {inModifica && <span className="help">(vuoto = invariata)</span>}
              </label>
              <input id="password" name="password" type="password" className="input" required={!inModifica} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="ruolo">Ruolo</label>
            <select id="ruolo" name="ruolo" className="select" defaultValue={inModifica?.ruolo ?? "editor"}>
              <option value="admin">Amministratore (può modificare tutto)</option>
              <option value="editor">Editor (solo i permessi assegnati sotto)</option>
            </select>
          </div>

          <div className="field">
            <label>Permessi Editor</label>
            <p className="help" style={{ marginBottom: "0.4rem" }}>
              Validi solo per il ruolo Editor (l&apos;Amministratore può sempre tutto). Nessuna
              casella selezionata = nessun accesso alle relative sezioni: l&apos;editor vedrà
              solo le voci di menu e le card in home per cui ha un permesso qui sotto.
            </p>
            <div className="field field--check">
              <input id="canEditUfficiali" name="canEditUfficiali" type="checkbox" defaultChecked={inModifica?.canEditUfficiali ?? false} />
              <label htmlFor="canEditUfficiali" style={{ color: "var(--text)" }}>
                Può modificare le comunicazioni ufficiali
              </label>
            </div>
            <div className="field field--check">
              <input id="canEditNonUfficiali" name="canEditNonUfficiali" type="checkbox" defaultChecked={inModifica?.canEditNonUfficiali ?? false} />
              <label htmlFor="canEditNonUfficiali" style={{ color: "var(--text)" }}>
                Può modificare le comunicazioni non ufficiali
              </label>
            </div>
            <div className="field field--check">
              <input id="canEditRsu" name="canEditRsu" type="checkbox" defaultChecked={inModifica?.canEditRsu ?? false} />
              <label htmlFor="canEditRsu" style={{ color: "var(--text)" }}>
                Può modificare le comunicazioni RSU
              </label>
            </div>
            <div className="field field--check">
              <input id="canEditSicurezza" name="canEditSicurezza" type="checkbox" defaultChecked={inModifica?.canEditSicurezza ?? false} />
              <label htmlFor="canEditSicurezza" style={{ color: "var(--text)" }}>
                Può modificare le comunicazioni di Sicurezza sul lavoro
              </label>
            </div>
            <div className="field field--check">
              <input id="canEditEventi" name="canEditEventi" type="checkbox" defaultChecked={inModifica?.canEditEventi ?? false} />
              <label htmlFor="canEditEventi" style={{ color: "var(--text)" }}>
                Può modificare le comunicazioni Eventi
              </label>
            </div>
            <div className="field field--check">
              <input id="canEditFormazione" name="canEditFormazione" type="checkbox" defaultChecked={inModifica?.canEditFormazione ?? false} />
              <label htmlFor="canEditFormazione" style={{ color: "var(--text)" }}>
                Può modificare le comunicazioni di Notizie Formazione
              </label>
            </div>
            <div className="field field--check">
              <input id="canManageSondaggi" name="canManageSondaggi" type="checkbox" defaultChecked={inModifica?.canManageSondaggi ?? false} />
              <label htmlFor="canManageSondaggi" style={{ color: "var(--text)" }}>
                Può creare e gestire sondaggi
              </label>
            </div>
            <div className="field field--check">
              <input id="canEditRubrica" name="canEditRubrica" type="checkbox" defaultChecked={inModifica?.canEditRubrica ?? false} />
              <label htmlFor="canEditRubrica" style={{ color: "var(--text)" }}>
                Può modificare la rubrica
              </label>
            </div>
            <div className="field field--check">
              <input id="canEditRegolamenti" name="canEditRegolamenti" type="checkbox" defaultChecked={inModifica?.canEditRegolamenti ?? false} />
              <label htmlFor="canEditRegolamenti" style={{ color: "var(--text)" }}>
                Può modificare i regolamenti
              </label>
            </div>
            <div className="field field--check">
              <input id="canEditProcedure" name="canEditProcedure" type="checkbox" defaultChecked={inModifica?.canEditProcedure ?? false} />
              <label htmlFor="canEditProcedure" style={{ color: "var(--text)" }}>
                Può modificare le procedure
              </label>
            </div>
            <div className="field field--check">
              <input id="canEditGuide" name="canEditGuide" type="checkbox" defaultChecked={inModifica?.canEditGuide ?? false} />
              <label htmlFor="canEditGuide" style={{ color: "var(--text)" }}>
                Può modificare le guide
              </label>
            </div>
            <div className="field field--check">
              <input id="canEditCartaIntestata" name="canEditCartaIntestata" type="checkbox" defaultChecked={inModifica?.canEditCartaIntestata ?? false} />
              <label htmlFor="canEditCartaIntestata" style={{ color: "var(--text)" }}>
                Può modificare la carta intestata
              </label>
            </div>
            <div className="field field--check">
              <input id="canManageSegnalazioni" name="canManageSegnalazioni" type="checkbox" defaultChecked={inModifica?.canManageSegnalazioni ?? false} />
              <label htmlFor="canManageSegnalazioni" style={{ color: "var(--text)" }}>
                Può gestire le segnalazioni ricevute
              </label>
            </div>
            <div className="field field--check">
              <input id="canManagePacchi" name="canManagePacchi" type="checkbox" defaultChecked={inModifica?.canManagePacchi ?? false} />
              <label htmlFor="canManagePacchi" style={{ color: "var(--text)" }}>
                Può gestire &quot;Di chi è?&quot; (pacchi in reception)
              </label>
            </div>
            <div className="field field--check">
              <input
                id="canVedereFormazioneTutti"
                name="canVedereFormazioneTutti"
                type="checkbox"
                defaultChecked={inModifica?.canVedereFormazioneTutti ?? false}
              />
              <label htmlFor="canVedereFormazioneTutti" style={{ color: "var(--text)" }}>
                Vede le attività formative di tutti i dipendenti (non solo dei propri sottoposti)
              </label>
            </div>
            <div className="field field--check">
              <input
                id="canEsportareFormazione"
                name="canEsportareFormazione"
                type="checkbox"
                defaultChecked={inModifica?.canEsportareFormazione ?? false}
              />
              <label htmlFor="canEsportareFormazione" style={{ color: "var(--text)" }}>
                Può esportare la Formazione in Excel (implica la visibilità su tutti i dipendenti)
              </label>
            </div>
          </div>

          <div className="field">
            <label>Uffici (ereditati dal contatto rubrica)</label>
            <p className="help" style={{ marginBottom: "0.4rem" }}>
              Validi solo per il ruolo Editor: gestisce moduli e compilazioni degli uffici
              del contatto rubrica collegato sopra (assegnare un&apos;Area o un Settore vale
              anche per tutto ciò che sta sotto). Per cambiarli, modifica gli uffici del
              contatto da &quot;Rubrica&quot; — non si assegnano più qui sull&apos;utente.
            </p>
            {!contattoCollegato ? (
              <p className="help">
                Nessun contatto collegato: collega un nominativo dalla rubrica qui sopra per
                ereditarne gli uffici.
              </p>
            ) : contattoCollegato.uffici.length === 0 ? (
              <p className="help">
                {contattoCollegato.nome} non ha uffici assegnati in rubrica: assegnali da
                &quot;Rubrica&quot; prima.
              </p>
            ) : (
              <p>{contattoCollegato.uffici.map((u) => u.nome).join(", ")}</p>
            )}
          </div>

          <div>
            <button type="submit" className="btn btn--primary">
              {inModifica ? "Salva modifiche" : "Crea utente"}
            </button>
          </div>
        </form>
      </div>

      {/* --- Elenco --- */}
      <ul className="admin-list">
        {utenti.map((u) => (
          <li key={u.id} className="card admin-row">
            <span style={{ fontSize: "1.3rem" }}>{u.ruolo === "admin" ? "🛡️" : "✏️"}</span>
            <div className="admin-row__main">
              <div className="admin-row__title">
                {contattiPerId.get(u.contattoId ?? "")?.nome ?? u.username}{" "}
                {u.id === me.id && <span className="badge">tu</span>}
              </div>
              <div className="admin-row__sub">
                {contattiPerId.get(u.contattoId ?? "") && `${u.username} · `}
                {u.ruolo === "admin"
                  ? "Amministratore"
                  : `Editor · ${[
                      u.canEditUfficiali && "comunicazioni ufficiali",
                      u.canEditNonUfficiali && "non ufficiali",
                      u.canEditRsu && "RSU",
                      u.canEditSicurezza && "sicurezza sul lavoro",
                      u.canEditEventi && "eventi",
                      u.canEditFormazione && "notizie formazione",
                      u.canManageSondaggi && "sondaggi",
                      u.canEditRubrica && "rubrica",
                      u.canEditRegolamenti && "regolamenti",
                      u.canEditProcedure && "procedure",
                      u.canEditGuide && "guide",
                      u.canEditCartaIntestata && "carta intestata",
                      u.canManageSegnalazioni && "segnalazioni",
                      u.canManagePacchi && "di chi è?",
                      u.canVedereFormazioneTutti && "vede formazione di tutti",
                      u.canEsportareFormazione && "esporta formazione",
                    ]
                      .filter(Boolean)
                      .join(", ") || "nessun permesso"}`}
                {u.ruolo === "editor" &&
                  ` · uffici: ${
                    uffici.filter((o) => u.uffici.includes(o.id)).map((o) => o.nome).join(", ") ||
                    "nessuno"
                  }`}
              </div>
            </div>
            <div className="admin-row__actions">
              <Link href={`/admin/utenti?edit=${u.id}`} className="btn btn--ghost btn--sm">
                Modifica
              </Link>
              {u.id !== me.id && (
                <form action={removeUser} className="inline-form">
                  <input type="hidden" name="id" value={u.id} />
                  <button type="submit" className="btn btn--danger btn--sm">Elimina</button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
