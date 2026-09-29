"use client";

import { useState, useTransition } from "react";
import type { MenuId } from "@/types";
import { reorderMenu, salvaEtichetta, salvaPubblicazioneMenu } from "@/app/admin/actions";
import { PREFISSO_ETICHETTA } from "@/lib/etichette-menu";
import { PREFISSO_PUBBLICATO } from "@/lib/pubblicazione-menu";

export interface VoceMenu {
  chiave: string;
  label: string;
  icon: string;
  // Presente solo per gli elenchi che supportano il flag pubblica/nascondi (vedi
  // prop `conPubblicazione` sotto): assente altrove, il toggle non viene mostrato.
  pubblicato?: boolean;
}

// Stesso pattern drag&drop nativo di admin/(panel)/servizi/SortableList.tsx, riusato
// per tutti gli elenchi riordinabili di questo tipo (menu pubblico, menu admin e —
// da /admin/impostazioni — sezioni home: stessa forma {chiave,label,icon}, vedi
// MenuId in types/index.ts). Il drag&drop parte solo dalla maniglia (non dall'intera
// riga, come in servizi/SortableList.tsx) perché qui la riga contiene anche un campo
// di testo modificabile: stesso accorgimento già usato in ModuloEditor/CampoCard per
// lo stesso motivo. Il testo del campo è salvato al blur tramite salvaEtichetta, che
// scrive un override in `impostazioni` con la chiave con prefisso di namespacing
// corretto per questo elenco (vedi PREFISSO_ETICHETTA).
export default function MenuSortableList({
  menu,
  voci,
  conPubblicazione = false,
}: {
  menu: MenuId;
  voci: VoceMenu[];
  // Mostra il toggle "visibile sul sito" per questo elenco: solo il menu pubblico
  // ha senso nasconderlo dal frontend, il menu admin resta sempre visibile a chi
  // ha i permessi (vedi buildAdminMenuItems in lib/admin-menu.ts).
  conPubblicazione?: boolean;
}) {
  const [items, setItems] = useState(voci);
  const [dragId, setDragId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleDrop(targetChiave: string) {
    if (!dragId || dragId === targetChiave) return;
    setItems((prev) => {
      const next = [...prev];
      const fromIdx = next.findIndex((v) => v.chiave === dragId);
      const toIdx = next.findIndex((v) => v.chiave === targetChiave);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      startTransition(() => {
        reorderMenu(menu, next.map((v) => v.chiave));
      });
      return next;
    });
    setDragId(null);
  }

  function handleLabelBlur(chiave: string, valore: string) {
    const label = valore.trim();
    const corrente = items.find((v) => v.chiave === chiave);
    if (!label || !corrente || label === corrente.label) return;
    setItems((prev) => prev.map((v) => (v.chiave === chiave ? { ...v, label } : v)));
    startTransition(() => {
      salvaEtichetta(`${PREFISSO_ETICHETTA[menu]}${chiave}`, label);
    });
  }

  function handleTogglePubblicato(chiave: string, pubblicato: boolean) {
    setItems((prev) => prev.map((v) => (v.chiave === chiave ? { ...v, pubblicato } : v)));
    startTransition(() => {
      salvaPubblicazioneMenu(`${PREFISSO_PUBBLICATO[menu]}${chiave}`, pubblicato);
    });
  }

  return (
    <ul className="admin-list">
      {items.map((v) => (
        <li
          key={v.chiave}
          className="card admin-row"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(v.chiave)}
          style={{ opacity: dragId === v.chiave ? 0.5 : 1 }}
        >
          <span
            className="admin-row__handle"
            aria-hidden
            title="Trascina per riordinare"
            draggable
            onDragStart={() => setDragId(v.chiave)}
            onDragEnd={() => setDragId(null)}
          >
            ⠿
          </span>
          <span style={{ fontSize: "1.4rem" }}>{v.icon}</span>
          <div className="admin-row__main">
            <input
              className="admin-row__title-input"
              defaultValue={v.label}
              onBlur={(e) => handleLabelBlur(v.chiave, e.target.value)}
              aria-label={`Nome per "${v.label}"`}
              title="Clicca per rinominare"
            />
          </div>
          {conPubblicazione && (
            <div className="admin-row__actions">
              {v.pubblicato === false && <span className="badge">nascosta</span>}
              <div className="field field--check" style={{ margin: 0 }}>
                <input
                  id={`pubblicato-${v.chiave}`}
                  type="checkbox"
                  checked={v.pubblicato ?? true}
                  onChange={(e) => handleTogglePubblicato(v.chiave, e.target.checked)}
                />
                <label htmlFor={`pubblicato-${v.chiave}`}>Visibile sul sito</label>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
