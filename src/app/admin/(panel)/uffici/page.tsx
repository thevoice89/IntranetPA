import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { listUffici, getContatti, getResponsabiliPerUffici } from "@/lib/data";
import { antenatiDi, discendentiDi } from "@/lib/uffici-tree";
import { saveUfficio, removeUfficio, saveResponsabiliUfficio } from "@/app/admin/actions";
import ResponsabiliPicker from "@/components/admin/ResponsabiliPicker";
import PersoneUfficio from "@/components/admin/PersoneUfficio";
import type { Contatto, LivelloUfficio, ResponsabileUfficio, Ufficio } from "@/types";

export const dynamic = "force-dynamic";

const ERRORI: Record<string, string> = {
  ha_figli: "Impossibile eliminare: contiene ancora Settori o Uffici sotto di sé.",
  in_uso_moduli: "Impossibile eliminare: è associato ad almeno un modulo.",
  in_uso_rubrica: "Impossibile eliminare: è assegnato ad almeno un contatto in rubrica.",
  in_uso_procedure: "Impossibile eliminare: è assegnato ad almeno una procedura.",
};

const ICONE: Record<LivelloUfficio, string> = { area: "🏛️", settore: "📂", ufficio: "📁" };

// Responsabili che il nodo eredita dal primo antenato che ne ha di propri
// (antenatiDi parte dal nodo stesso, quindi si salta il primo elemento). null =
// nessun antenato ne ha: il ramo è scoperto e nessuno vedrà chi ci lavora.
function ereditati(
  nodo: Ufficio,
  uffici: Ufficio[],
  perUfficio: Map<string, ResponsabileUfficio[]>
): { da: Ufficio; responsabili: ResponsabileUfficio[] } | null {
  for (const id of antenatiDi(nodo.id, uffici).slice(1)) {
    const responsabili = perUfficio.get(id) ?? [];
    if (responsabili.length > 0) {
      const da = uffici.find((u) => u.id === id);
      if (da) return { da, responsabili };
    }
  }
  return null;
}

// Persone assegnate direttamente a un nodo o a un suo discendente qualsiasi:
// il numero mostrato nell'intestazione di Aree e Settori, per farsi un'idea
// senza dover aprire ogni ramo. Non tiene conto dell'eredità dei responsabili
// (concetto diverso): qui si contano le persone vere e proprie di rubrica.
function personeNelSottoalbero(nodoId: string, uffici: Ufficio[], contatti: Contatto[]): number {
  const ids = new Set(discendentiDi(nodoId, uffici));
  return contatti.filter((c) => c.uffici.some((u) => ids.has(u.id))).length;
}

// Riga dei responsabili sotto ogni nodo. Si modifica un nodo alla volta via
// ?resp=<id> (stesso schema di ?edit=<id> già usato in guide/moduli/comunicazioni):
// così il picker — che si porta dietro l'intera rubrica — viene montato una volta
// sola invece che su tutte e quaranta le righe dell'albero.
function RigaResponsabili({
  nodo,
  uffici,
  perUfficio,
  contatti,
  inModifica,
}: {
  nodo: Ufficio;
  uffici: Ufficio[];
  perUfficio: Map<string, ResponsabileUfficio[]>;
  contatti: Contatto[];
  inModifica: boolean;
}) {
  const propri = perUfficio.get(nodo.id) ?? [];

  if (inModifica) {
    return (
      <form
        action={saveResponsabiliUfficio}
        style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end", flexWrap: "wrap" }}
      >
        <input type="hidden" name="ufficioId" value={nodo.id} />
        <ResponsabiliPicker
          key={nodo.id}
          contatti={contatti}
          defaultResponsabili={propri}
          inputId={`resp-${nodo.id}`}
        />
        <button type="submit" className="btn btn--primary btn--sm">
          Salva
        </button>
        <Link href={`/admin/uffici#ufficio-${nodo.id}`} className="btn btn--ghost btn--sm">
          Annulla
        </Link>
      </form>
    );
  }

  const eredita = propri.length === 0 ? ereditati(nodo, uffici, perUfficio) : null;

  return (
    <div className="org-resp-row">
      <span className="admin-row__sub" style={{ whiteSpace: "normal", flex: 1 }}>
        {propri.length > 0 ? (
          <>🧭 Responsabile/i: {propri.map((r) => r.nome).join(", ")}</>
        ) : eredita ? (
          <>
            ↳ eredita da {eredita.da.nome}: {eredita.responsabili.map((r) => r.nome).join(", ")}
          </>
        ) : (
          <span style={{ color: "var(--warn)" }}>
            ⚠ Nessun responsabile, nemmeno ai livelli superiori
          </span>
        )}
      </span>
      <Link
        href={`/admin/uffici?resp=${nodo.id}#ufficio-${nodo.id}`}
        className="btn btn--ghost btn--sm"
      >
        {propri.length > 0 ? "Modifica responsabili" : "Assegna responsabile"}
      </Link>
    </div>
  );
}

// Rinomina/riassegna-genitore + elimina, per un nodo a qualunque livello.
// `opzioniGenitore` è null per le Aree (nessun genitore da scegliere). Il nome
// usa lo stesso input "sembra testo finché non lo tocchi" del menu, per non
// far sembrare l'intero albero un modulo da compilare.
function RigaModifica({
  nodo,
  opzioniGenitore,
}: {
  nodo: Ufficio;
  opzioniGenitore: Ufficio[] | null;
}) {
  return (
    <div className="org-edit-row">
      <form action={saveUfficio} className="org-edit-row__rename">
        <input type="hidden" name="id" value={nodo.id} />
        <input type="hidden" name="livello" value={nodo.livello} />
        <input
          name="nome"
          className="admin-row__title-input"
          defaultValue={nodo.nome}
          required
          aria-label={`Rinomina ${nodo.nome}`}
          title="Clicca per rinominare"
          style={{ flex: 1, minWidth: "10rem" }}
        />
        {opzioniGenitore && (
          <select
            name="parentId"
            className="select org-edit-row__parent"
            defaultValue={nodo.parentId ?? ""}
            aria-label={`Sposta ${nodo.nome} sotto un altro genitore`}
          >
            {opzioniGenitore.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </select>
        )}
        <button type="submit" className="btn btn--ghost btn--sm">
          Salva
        </button>
      </form>
      <form action={removeUfficio} className="inline-form">
        <input type="hidden" name="id" value={nodo.id} />
        <button
          type="submit"
          className="btn btn--danger btn--sm"
          title="Elimina"
          aria-label={`Elimina ${nodo.nome}`}
        >
          🗑️
        </button>
      </form>
    </div>
  );
}

// Corpo comune a ogni nodo (modifica + responsabili + persone), con gli
// eventuali figli passati come children per restare annidati nello stesso
// ramo verticale (.org-branch).
function CorpoNodo({
  nodo,
  opzioniGenitore,
  uffici,
  contatti,
  perUfficio,
  resp,
  children,
}: {
  nodo: Ufficio;
  opzioniGenitore: Ufficio[] | null;
  uffici: Ufficio[];
  contatti: Contatto[];
  perUfficio: Map<string, ResponsabileUfficio[]>;
  resp: string | undefined;
  children?: ReactNode;
}) {
  return (
    <div className="org-node__body">
      <RigaModifica nodo={nodo} opzioniGenitore={opzioniGenitore} />
      <RigaResponsabili
        nodo={nodo}
        uffici={uffici}
        perUfficio={perUfficio}
        contatti={contatti}
        inModifica={resp === nodo.id}
      />
      <PersoneUfficio ufficioId={nodo.id} contatti={contatti} />
      {children}
    </div>
  );
}

function NuovoNodoForm({
  parentId,
  livello,
  placeholder,
}: {
  parentId: string | null;
  livello: LivelloUfficio;
  placeholder: string;
}) {
  return (
    <form action={saveUfficio} className="field--row" style={{ margin: "0.2rem 0" }}>
      <input type="hidden" name="livello" value={livello} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <div className="field" style={{ flex: 1 }}>
        <input name="nome" className="input" placeholder={placeholder} required />
      </div>
      <div>
        <button type="submit" className="btn btn--ghost btn--sm">+ Aggiungi</button>
      </div>
    </form>
  );
}

export default async function AdminUffici({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; resp?: string }>;
}) {
  await requireAdmin();
  const { error, resp } = await searchParams;

  const [uffici, contatti] = await Promise.all([listUffici(), getContatti()]);
  const perUfficio = await getResponsabiliPerUffici(uffici.map((u) => u.id));

  const ordinaPerNome = (a: Ufficio, b: Ufficio) => a.nome.localeCompare(b.nome, "it");
  const aree = uffici.filter((u) => u.livello === "area").sort(ordinaPerNome);
  const settori = uffici.filter((u) => u.livello === "settore").sort(ordinaPerNome);
  const foglie = uffici.filter((u) => u.livello === "ufficio").sort(ordinaPerNome);

  // Copertura: un nodo è "scoperto" solo se né lui né alcun antenato ha un
  // responsabile — non basta che manchi sul nodo stesso, visto che l'eredità
  // risale l'albero. I contatti senza ufficio sono l'altro buco possibile: non
  // appartenendo a nessun nodo, non ricadono sotto nessun responsabile.
  const scoperti = uffici.filter((u) =>
    antenatiDi(u.id, uffici).every((id) => (perUfficio.get(id) ?? []).length === 0)
  ).length;
  const senzaUfficio = contatti.filter((c) => c.uffici.length === 0).length;
  const stileAvviso = { background: "var(--warn-soft)", color: "var(--warn)" };

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>Uffici</h1>
          <p>
            Organigramma del Comune — Aree, Settori e Uffici. Questa struttura è usata
            ovunque nella piattaforma si assegni o filtri per ufficio (rubrica, procedure,
            moduli, permessi editor): un nodo assegnato a un Settore o un&apos;Area vale
            automaticamente anche per tutto ciò che sta sotto.
          </p>
          <p>
            Il <strong>responsabile</strong> di un nodo vale anche per tutto ciò che sta
            sotto: basta quindi assegnarlo ad Aree e Settori, e scendere sul singolo
            Ufficio solo dove serve un&apos;eccezione. Da qui si deciderà chi vede i dati
            dei propri collaboratori (a partire dalla Formazione). Apri &quot;👥 persone&quot;
            su un nodo per vedere, aggiungere o togliere chi vi appartiene: la modifica
            parla direttamente con la Rubrica, e il nome porta alla scheda della persona.
          </p>
        </div>
      </header>

      {error && <div className="alert">{ERRORI[error] ?? "Operazione non valida."}</div>}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <span className="badge" style={scoperti > 0 ? stileAvviso : undefined}>
          {scoperti} nodi senza responsabile, nemmeno ereditato
        </span>
        <span className="badge" style={senzaUfficio > 0 ? stileAvviso : undefined}>
          {senzaUfficio} contatti in rubrica senza ufficio
        </span>
      </div>

      {aree.length > 0 ? (
        <div className="org-tree" style={{ marginBottom: "0.75rem" }}>
          {aree.map((area) => {
            const settoriArea = settori.filter((s) => s.parentId === area.id);
            return (
              <details key={area.id} className="org-node org-node--area" id={`ufficio-${area.id}`} open>
                <summary className="org-node__head">
                  <span className="org-node__chevron" aria-hidden>▸</span>
                  <span className="org-node__icon">{ICONE.area}</span>
                  <span className="org-node__name">{area.nome}</span>
                  <span className="org-node__meta">
                    {settoriArea.length} {settoriArea.length === 1 ? "settore" : "settori"} ·{" "}
                    {personeNelSottoalbero(area.id, uffici, contatti)} persone
                  </span>
                </summary>
                <CorpoNodo
                  nodo={area}
                  opzioniGenitore={null}
                  uffici={uffici}
                  contatti={contatti}
                  perUfficio={perUfficio}
                  resp={resp}
                >
                  <div className="org-branch">
                    {settoriArea.map((settore) => {
                      const uffciSettore = foglie.filter((u) => u.parentId === settore.id);
                      return (
                        <details
                          key={settore.id}
                          className="org-node org-node--settore"
                          id={`ufficio-${settore.id}`}
                          open
                        >
                          <summary className="org-node__head">
                            <span className="org-node__chevron" aria-hidden>▸</span>
                            <span className="org-node__icon">{ICONE.settore}</span>
                            <span className="org-node__name">{settore.nome}</span>
                            <span className="org-node__meta">
                              {uffciSettore.length} {uffciSettore.length === 1 ? "ufficio" : "uffici"} ·{" "}
                              {personeNelSottoalbero(settore.id, uffici, contatti)} persone
                            </span>
                          </summary>
                          <CorpoNodo
                            nodo={settore}
                            opzioniGenitore={aree}
                            uffici={uffici}
                            contatti={contatti}
                            perUfficio={perUfficio}
                            resp={resp}
                          >
                            <div className="org-branch">
                              {uffciSettore.map((ufficio) => (
                                <details
                                  key={ufficio.id}
                                  className="org-node org-node--ufficio"
                                  id={`ufficio-${ufficio.id}`}
                                  open
                                >
                                  <summary className="org-node__head">
                                    <span className="org-node__chevron" aria-hidden>▸</span>
                                    <span className="org-node__icon">{ICONE.ufficio}</span>
                                    <span className="org-node__name">{ufficio.nome}</span>
                                    <span className="org-node__meta">
                                      {personeNelSottoalbero(ufficio.id, uffici, contatti)} persone
                                    </span>
                                  </summary>
                                  <CorpoNodo
                                    nodo={ufficio}
                                    opzioniGenitore={settori}
                                    uffici={uffici}
                                    contatti={contatti}
                                    perUfficio={perUfficio}
                                    resp={resp}
                                  />
                                </details>
                              ))}
                              <NuovoNodoForm
                                parentId={settore.id}
                                livello="ufficio"
                                placeholder={`Nuovo ufficio in ${settore.nome}`}
                              />
                            </div>
                          </CorpoNodo>
                        </details>
                      );
                    })}
                    <NuovoNodoForm
                      parentId={area.id}
                      livello="settore"
                      placeholder={`Nuovo settore in ${area.nome}`}
                    />
                  </div>
                </CorpoNodo>
              </details>
            );
          })}
        </div>
      ) : (
        <p className="help" style={{ marginBottom: "1rem" }}>Nessuna Area.</p>
      )}

      <NuovoNodoForm parentId={null} livello="area" placeholder="Nuova area" />
    </section>
  );
}
