"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  saveModulo,
  addAllegatoModuloLink,
  uploadAllegatoModuloFile,
  removeAllegatoModulo,
} from "@/app/admin/actions";
import { TIPI_CAMPO_MODULO } from "@/types";
import type { Contatto, Modulo, ModuloCampo, TipoCampoModulo, TipoModulo, Ufficio } from "@/types";
import UfficioPicker from "@/components/admin/UfficioPicker";
import RichTextEditor from "@/components/admin/RichTextEditor";
import PubblicaNotiziaCheckbox from "@/components/admin/PubblicaNotiziaCheckbox";

// Id lato client per le domande nuove (prima del salvataggio). Niente
// crypto.randomUUID(): il pannello admin gira anche su HTTP semplice in rete
// locale, dove randomUUID() non è disponibile (richiede un contesto sicuro).
let contatoreId = 0;
function nuovoId(): string {
  contatoreId += 1;
  return `n${Date.now().toString(36)}${contatoreId}${Math.random().toString(36).slice(2, 8)}`;
}

interface CampoDraft {
  id: string;
  etichetta: string;
  tipo: TipoCampoModulo;
  opzioni: string[];
  obbligatorio: boolean;
}

function daModuloCampo(c: ModuloCampo): CampoDraft {
  return {
    id: c.id,
    etichetta: c.etichetta,
    tipo: c.tipo,
    opzioni: c.opzioni,
    obbligatorio: c.obbligatorio,
  };
}

const TIPI_CON_OPZIONI: TipoCampoModulo[] = ["select", "radio"];

function SaveButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn--primary" disabled={pending}>
      {pending ? "Salvataggio…" : isNew ? "Crea modulo" : "Salva modifiche"}
    </button>
  );
}

export default function ModuloEditor({
  modulo,
  uffici,
  contatti = [],
  puoPubblicareNotizia = false,
}: {
  modulo: Modulo | null;
  uffici: Ufficio[];
  contatti?: Contatto[];
  puoPubblicareNotizia?: boolean;
}) {
  const [campi, setCampi] = useState<CampoDraft[]>(
    () => modulo?.campi.map(daModuloCampo) ?? []
  );
  const [descrizione, setDescrizione] = useState(modulo?.descrizione ?? "");
  const [dragId, setDragId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  // Fissato alla creazione (vedi TipoModulo in types/index.ts): in modifica non
  // è più possibile cambiarlo, quindi il selettore sotto compare solo per un
  // modulo nuovo.
  const [tipo, setTipo] = useState<TipoModulo>(modulo?.tipo ?? "form");
  const isDocumento = tipo === "documento";
  const isPdf = tipo === "pdf";

  function aggiungiDomanda() {
    const nuovo: CampoDraft = {
      id: nuovoId(),
      etichetta: "",
      tipo: "testo",
      opzioni: [],
      obbligatorio: false,
    };
    setCampi((prev) => [...prev, nuovo]);
    setFocusId(nuovo.id);
  }

  function aggiornaCampo(id: string, patch: Partial<CampoDraft>) {
    setCampi((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function cambiaTipo(id: string, tipo: TipoCampoModulo) {
    setCampi((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (!TIPI_CON_OPZIONI.includes(tipo)) return { ...c, tipo };
        return { ...c, tipo, opzioni: c.opzioni.length > 0 ? c.opzioni : ["Opzione 1"] };
      })
    );
  }

  function rimuoviCampo(id: string) {
    setCampi((prev) => prev.filter((c) => c.id !== id));
  }

  function duplicaCampo(id: string) {
    setCampi((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      const copia: CampoDraft = { ...prev[idx], id: nuovoId(), opzioni: [...prev[idx].opzioni] };
      const next = [...prev];
      next.splice(idx + 1, 0, copia);
      return next;
    });
  }

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setCampi((prev) => {
      const next = [...prev];
      const fromIdx = next.findIndex((c) => c.id === dragId);
      const toIdx = next.findIndex((c) => c.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDragId(null);
  }

  return (
    <>
    <form action={saveModulo} className="modulo-editor">
      <input type="hidden" name="id" value={modulo?.id ?? ""} />
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="campi" value={JSON.stringify(campi)} readOnly />
      <input type="hidden" name="descrizione" value={descrizione} readOnly />

      <div className="card modulo-editor__header">
        {!modulo && (
          <div className="modulo-editor__tipo" role="radiogroup" aria-label="Tipo di modulo">
            <button
              type="button"
              className={`modulo-tipo-opt${tipo === "form" ? " is-active" : ""}`}
              aria-pressed={tipo === "form"}
              onClick={() => setTipo("form")}
            >
              <strong>📝 Form da compilare</strong>
              <span className="help">Domande online, risposte raccolte in &quot;Moduli ricevuti&quot;.</span>
            </button>
            <button
              type="button"
              className={`modulo-tipo-opt${isDocumento ? " is-active" : ""}`}
              aria-pressed={isDocumento}
              onClick={() => setTipo("documento")}
            >
              <strong>📄 Documento da scaricare</strong>
              <span className="help">Carica un file già pronto (Word, PDF…): nessuna domanda, solo download.</span>
            </button>
            <button
              type="button"
              className={`modulo-tipo-opt${isPdf ? " is-active" : ""}`}
              aria-pressed={isPdf}
              onClick={() => setTipo("pdf")}
            >
              <strong>🖨️ Compilabile, genera PDF</strong>
              <span className="help">
                Domande online come il form, ma chi compila scarica subito un PDF: nessuna risposta
                salvata, nessuna notifica.
              </span>
            </button>
          </div>
        )}
        {modulo && isDocumento && (
          <div className="badge" style={{ marginBottom: "0.6rem" }}>📄 Documento da scaricare</div>
        )}
        {modulo && isPdf && (
          <div className="badge" style={{ marginBottom: "0.6rem" }}>🖨️ Compilabile, genera PDF</div>
        )}
        <input
          name="titolo"
          className="modulo-editor__titolo"
          required
          placeholder="Titolo del modulo"
          defaultValue={modulo?.titolo ?? ""}
          aria-label="Titolo del modulo"
        />
        <div className="modulo-editor__descrizione">
          <RichTextEditor
            value={descrizione}
            onChange={setDescrizione}
            placeholder={
              isDocumento
                ? "Descrizione (facoltativa) mostrata sopra il documento…"
                : "Descrizione (facoltativa) mostrata a chi compila…"
            }
            ariaLabel="Descrizione del modulo"
          />
        </div>

        <div className="modulo-editor__meta">
          <UfficioPicker uffici={uffici} defaultUfficioId={modulo?.ufficioId} label="Ufficio destinatario" />
          {tipo === "form" && (
            <div className="field">
              <label htmlFor="emailNotifica">Email di notifica</label>
              <input
                id="emailNotifica"
                name="emailNotifica"
                type="email"
                className="input"
                placeholder="Es. ufficio@comune.it (facoltativa)"
                defaultValue={modulo?.emailNotifica ?? ""}
              />
            </div>
          )}
          <div className="field field--check" style={{ alignSelf: "center" }}>
            <input
              id="pubblicato"
              name="pubblicato"
              type="checkbox"
              defaultChecked={modulo?.pubblicato ?? false}
            />
            <label htmlFor="pubblicato" style={{ color: "var(--text)" }}>
              {isDocumento ? "Pubblicato (visibile e scaricabile sul sito)" : "Pubblicato (visibile e compilabile sul sito)"}
            </label>
          </div>
        </div>
      </div>

      {isPdf && (
        <div className="card modulo-editor__header" style={{ marginTop: "1.25rem" }}>
          <div className="section-title" style={{ marginTop: 0 }}>Lettera generata (PDF)</div>
          <p className="help" style={{ marginBottom: "1rem" }}>
            Il PDF non elenca domanda/risposta: riproduce una lettera vera, con un corpo in prosa dove
            ogni <code>{"{{Etichetta del campo}}"}</code> viene sostituito dal valore compilato (l&apos;etichetta
            deve corrispondere esattamente a quella della domanda qui sotto).
          </p>
          <div className="modulo-editor__meta">
            <div className="field">
              <label htmlFor="pdfDestinatario">Destinatario (es. Servizio Gestione del Personale)</label>
              <input
                id="pdfDestinatario"
                name="pdfDestinatario"
                className="input"
                placeholder="Servizio Gestione del Personale"
                defaultValue={modulo?.pdfDestinatario ?? ""}
              />
            </div>
            <div className="field">
              <label htmlFor="pdfDestinatarioPc">Per conoscenza a (facoltativo)</label>
              <input
                id="pdfDestinatarioPc"
                name="pdfDestinatarioPc"
                className="input"
                placeholder="Responsabile del Settore di appartenenza"
                defaultValue={modulo?.pdfDestinatarioPc ?? ""}
              />
            </div>
          </div>
          <div className="field" style={{ marginTop: "0.9rem" }}>
            <label htmlFor="pdfCorpo">Corpo della lettera</label>
            <textarea
              id="pdfCorpo"
              name="pdfCorpo"
              className="textarea"
              rows={16}
              placeholder={"Il/la sottoscritto/a {{Nome e cognome}}, nato/a a {{Luogo di nascita}}…"}
              defaultValue={modulo?.pdfCorpo ?? ""}
            />
          </div>
          <div className="field" style={{ marginTop: "0.9rem" }}>
            <label htmlFor="pdfNota">Nota a piè di pagina (facoltativa)</label>
            <textarea
              id="pdfNota"
              name="pdfNota"
              className="textarea"
              rows={4}
              placeholder="(*) Nota: …"
              defaultValue={modulo?.pdfNota ?? ""}
            />
          </div>
        </div>
      )}

      {!isDocumento && (
        <>
          <div className="modulo-editor__domande">
            {campi.length === 0 && (
              <p className="help" style={{ padding: "0.3rem 0.2rem" }}>
                Nessuna domanda ancora. Aggiungine una qui sotto.
              </p>
            )}
            {campi.map((c) => (
              <CampoCard
                key={c.id}
                campo={c}
                dragging={dragId === c.id}
                autoFocusLabel={focusId === c.id}
                onFocusLabel={() => setFocusId(null)}
                onChange={(patch) => aggiornaCampo(c.id, patch)}
                onTipoChange={(tipo) => cambiaTipo(c.id, tipo)}
                onRemove={() => rimuoviCampo(c.id)}
                onDuplicate={() => duplicaCampo(c.id)}
                onDragStart={() => setDragId(c.id)}
                onDrop={() => handleDrop(c.id)}
                onDragEnd={() => setDragId(null)}
              />
            ))}
          </div>

          <button type="button" className="campo-add-card" onClick={aggiungiDomanda}>
            + Aggiungi domanda
          </button>
        </>
      )}

      {!modulo && puoPubblicareNotizia && <PubblicaNotiziaCheckbox contatti={contatti} />}

      <div className="modulo-editor__save">
        <SaveButton isNew={!modulo} />
        {modulo?.pubblicato && (
          <a href={`/moduli/${modulo.id}`} target="_blank" rel="noreferrer" className="help">
            Vedi modulo pubblico ↗
          </a>
        )}
      </div>
    </form>

    {/* --- Allegati (solo in modifica: serve l'id del modulo). Per un modulo
         "documento" è qui che si carica il file scaricabile (es. il Word già
         pronto): non c'è un flusso di compilazione/back office, la pagina
         pubblica mostra direttamente questi allegati come download. --- */}
    {modulo && (
      <div className="card" style={{ padding: "1.5rem", marginTop: "1.75rem", maxWidth: 760 }}>
        <div className="section-title" style={{ marginTop: 0 }}>
          {isDocumento ? "Documento da scaricare" : "Allegati al modulo"}
        </div>
        <p className="help" style={{ marginBottom: "1rem" }}>
          {isDocumento
            ? "Carica qui il file già pronto (es. Word, PDF): chi visita la pagina lo scarica direttamente, senza compilare nulla."
            : <>Documenti o link mostrati a chi consulta il modulo (es. istruzioni, modello cartaceo) — diversi
              dalla domanda &quot;Allegato (file)&quot;, che raccoglie un file da chi compila.</>}
        </p>

        {modulo.allegati && modulo.allegati.length > 0 ? (
          <ul className="admin-list" style={{ marginBottom: "1rem" }}>
            {modulo.allegati.map((a) => (
              <li key={a.id} className="card admin-row">
                <span>{a.tipo === "file" ? "📎" : "🔗"}</span>
                <div className="admin-row__main">
                  <div className="admin-row__title">{a.etichetta}</div>
                  <div className="admin-row__sub">{a.tipo === "file" ? "File caricato" : a.url}</div>
                </div>
                <div className="admin-row__actions">
                  <a href={a.url} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm">
                    Apri
                  </a>
                  <form action={removeAllegatoModulo} className="inline-form">
                    <input type="hidden" name="moduloId" value={modulo.id} />
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className="btn btn--danger btn--sm">Rimuovi</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="help" style={{ marginBottom: "1rem" }}>Nessun allegato.</p>
        )}

        <div className="field--row">
          <form action={uploadAllegatoModuloFile} className="form">
            <input type="hidden" name="moduloId" value={modulo.id} />
            <div className="field">
              <label htmlFor="allegatoFile">Carica un file</label>
              <input id="allegatoFile" name="file" type="file" className="input" required />
            </div>
            <div className="field">
              <label htmlFor="allegatoFileEtichetta">Etichetta (opzionale)</label>
              <input
                id="allegatoFileEtichetta"
                name="etichetta"
                className="input"
                placeholder="Es. Istruzioni per la compilazione"
              />
            </div>
            <button type="submit" className="btn btn--ghost">Carica file</button>
          </form>

          <form action={addAllegatoModuloLink} className="form">
            <input type="hidden" name="moduloId" value={modulo.id} />
            <div className="field">
              <label htmlFor="allegatoUrl">Link (es. SharePoint)</label>
              <input id="allegatoUrl" name="url" className="input" placeholder="https://..." required />
            </div>
            <div className="field">
              <label htmlFor="allegatoUrlEtichetta">Etichetta (opzionale)</label>
              <input
                id="allegatoUrlEtichetta"
                name="etichetta"
                className="input"
                placeholder="Es. Cartella SharePoint"
              />
            </div>
            <button type="submit" className="btn btn--ghost">Aggiungi link</button>
          </form>
        </div>
      </div>
    )}
    </>
  );
}

function CampoCard({
  campo,
  dragging,
  autoFocusLabel,
  onFocusLabel,
  onChange,
  onTipoChange,
  onRemove,
  onDuplicate,
  onDragStart,
  onDrop,
  onDragEnd,
}: {
  campo: CampoDraft;
  dragging: boolean;
  autoFocusLabel: boolean;
  onFocusLabel: () => void;
  onChange: (patch: Partial<CampoDraft>) => void;
  onTipoChange: (tipo: TipoCampoModulo) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onDragStart: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const mostraOpzioni = TIPI_CON_OPZIONI.includes(campo.tipo);
  const isTestoStatico = campo.tipo === "testo_statico";

  function aggiornaOpzione(idx: number, valore: string) {
    const next = [...campo.opzioni];
    next[idx] = valore;
    onChange({ opzioni: next });
  }
  function rimuoviOpzione(idx: number) {
    onChange({ opzioni: campo.opzioni.filter((_, i) => i !== idx) });
  }
  function aggiungiOpzione() {
    onChange({ opzioni: [...campo.opzioni, `Opzione ${campo.opzioni.length + 1}`] });
  }

  return (
    <div
      className="card campo-card"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      style={{ opacity: dragging ? 0.5 : 1 }}
    >
      <span
        className="campo-card__handle"
        aria-hidden
        title="Trascina per riordinare"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        ⠿
      </span>

      <div className="campo-card__body">
        <div className="campo-card__row">
          {isTestoStatico ? (
            <div style={{ flex: 1, minWidth: 0 }} onFocusCapture={onFocusLabel}>
              <RichTextEditor
                value={campo.etichetta}
                onChange={(html) => onChange({ etichetta: html })}
                placeholder="Testo da mostrare nel modulo…"
                ariaLabel="Testo informativo"
                autoFocus={autoFocusLabel}
              />
            </div>
          ) : (
            <input
              className="input"
              placeholder="Domanda senza titolo"
              value={campo.etichetta}
              onChange={(e) => onChange({ etichetta: e.target.value })}
              autoFocus={autoFocusLabel}
              onFocus={onFocusLabel}
              aria-label="Testo della domanda"
            />
          )}
          <select
            className="select campo-card__tipo"
            value={campo.tipo}
            onChange={(e) => onTipoChange(e.target.value as TipoCampoModulo)}
            aria-label="Tipo di domanda"
          >
            {TIPI_CAMPO_MODULO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {mostraOpzioni && (
          <div className="campo-opzioni">
            {campo.opzioni.map((o, idx) => (
              <div className="campo-opzione" key={idx}>
                <span className="campo-opzione__bullet" aria-hidden>
                  {campo.tipo === "radio" ? "○" : "•"}
                </span>
                <input
                  className="input"
                  value={o}
                  onChange={(e) => aggiornaOpzione(idx, e.target.value)}
                  placeholder={`Opzione ${idx + 1}`}
                />
                <button
                  type="button"
                  className="campo-opzione__remove"
                  onClick={() => rimuoviOpzione(idx)}
                  aria-label="Rimuovi opzione"
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="campo-add-opzione" onClick={aggiungiOpzione}>
              + Aggiungi opzione
            </button>
          </div>
        )}

        <div className="campo-card__foot">
          {isTestoStatico ? (
            <span className="help">Testo informativo: non richiede risposta.</span>
          ) : (
            <div className="field field--check">
              <input
                id={`obbl-${campo.id}`}
                type="checkbox"
                checked={campo.obbligatorio}
                onChange={(e) => onChange({ obbligatorio: e.target.checked })}
              />
              <label htmlFor={`obbl-${campo.id}`} style={{ color: "var(--text)" }}>
                Obbligatorio
              </label>
            </div>
          )}
          <div className="campo-card__foot-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={onDuplicate}
              title="Duplica domanda"
              aria-label="Duplica domanda"
            >
              ⧉
            </button>
            <button
              type="button"
              className="icon-btn icon-btn--danger"
              onClick={onRemove}
              title="Elimina domanda"
              aria-label="Elimina domanda"
            >
              🗑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
