"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { saveSondaggio } from "@/app/admin/actions";
import { TIPI_CAMPO_MODULO } from "@/types";
import type { Sondaggio, SondaggioCampo, TipoCampoModulo } from "@/types";
import RichTextEditor from "@/components/admin/RichTextEditor";

// Stesso editor "una pagina sola" stile Google Moduli di ModuloEditor.tsx,
// senza ufficio/email di notifica/allegati (i Sondaggi non li hanno, per ora
// sono una sezione solo admin senza compilazione pubblica). Id lato client per
// le domande nuove: niente crypto.randomUUID(), il pannello admin gira anche
// su HTTP semplice in rete locale (nessun contesto sicuro).
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

function daSondaggioCampo(c: SondaggioCampo): CampoDraft {
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
      {pending ? "Salvataggio…" : isNew ? "Crea sondaggio" : "Salva modifiche"}
    </button>
  );
}

export default function SondaggioEditor({ sondaggio }: { sondaggio: Sondaggio | null }) {
  const [campi, setCampi] = useState<CampoDraft[]>(
    () => sondaggio?.campi.map(daSondaggioCampo) ?? []
  );
  const [descrizione, setDescrizione] = useState(sondaggio?.descrizione ?? "");
  const [dragId, setDragId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

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
    <form action={saveSondaggio} className="modulo-editor">
      <input type="hidden" name="id" value={sondaggio?.id ?? ""} />
      <input type="hidden" name="campi" value={JSON.stringify(campi)} readOnly />
      <input type="hidden" name="descrizione" value={descrizione} readOnly />

      <div className="card modulo-editor__header">
        <input
          name="titolo"
          className="modulo-editor__titolo"
          required
          placeholder="Titolo del sondaggio"
          defaultValue={sondaggio?.titolo ?? ""}
          aria-label="Titolo del sondaggio"
        />
        <div className="modulo-editor__descrizione">
          <RichTextEditor
            value={descrizione}
            onChange={setDescrizione}
            placeholder="Descrizione (facoltativa)…"
            ariaLabel="Descrizione del sondaggio"
          />
        </div>

        <div className="modulo-editor__meta">
          <div className="field field--check" style={{ alignSelf: "center" }}>
            <input
              id="pubblicato"
              name="pubblicato"
              type="checkbox"
              defaultChecked={sondaggio?.pubblicato ?? false}
            />
            <label htmlFor="pubblicato" style={{ color: "var(--text)" }}>
              Pubblicato
            </label>
          </div>
          <p className="help" style={{ margin: 0 }}>
            Da qui puoi scriverlo con calma: diventa visibile e compilabile da tutti in
            /sondaggi solo quando spunti &quot;Pubblicato&quot;.
          </p>
        </div>
      </div>

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

      <div className="modulo-editor__save">
        <SaveButton isNew={!sondaggio} />
      </div>
    </form>
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
                placeholder="Testo da mostrare nel sondaggio…"
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
