"use client";

import { useEffect, useState } from "react";
import type { Contatto } from "@/types";
import { SelettorePersona } from "@/components/ui/SelettorePersona";

// Nominativo obbligatorio scelto dalla rubrica (mai testo libero): invia solo
// l'id del contatto scelto, il server risolve nome/email da lì così non si può
// aggirare la selezione postando testo libero via devtools. `storageKey`
// (opzionale) ricorda l'ultima selezione in localStorage, per non dover
// ricercare il proprio nominativo ad ogni visita (stesso pattern di
// PresenzeApp in (site)/presenze) — usato dal form pubblico delle comunicazioni
// non ufficiali, non da Segnalazioni (dove ogni invio riparte da zero).
export default function ContattoField({
  contatti,
  name = "contattoId",
  label = "Il tuo nominativo",
  help = "Scegli il tuo nominativo dall'elenco: serve per poterti rispondere.",
  storageKey,
  defaultContatto = null,
}: {
  contatti: Contatto[];
  name?: string;
  label?: string;
  help?: string;
  storageKey?: string;
  // Preseleziona un contatto (es. in modifica di un record già associato a un
  // nominativo): alternativa al recupero da localStorage, usata dai form admin
  // dove non ha senso ricordare "l'ultimo nominativo scelto" nel browser.
  defaultContatto?: Contatto | null;
}) {
  const [selezionato, setSelezionato] = useState<Contatto | null>(defaultContatto);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const id = localStorage.getItem(storageKey);
      if (id) {
        const trovato = contatti.find((c) => c.id === id);
        if (trovato) setSelezionato(trovato);
      }
    } catch {
      // storage non disponibile: ignora, si ricerca ogni volta.
    }
  }, [contatti, storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      if (selezionato) localStorage.setItem(storageKey, selezionato.id);
    } catch {
      // ignora
    }
  }, [selezionato, storageKey]);

  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <SelettorePersona
        id={name}
        contatti={contatti}
        selezionato={selezionato}
        onSeleziona={setSelezionato}
        placeholder="Cerca il tuo nominativo nella rubrica…"
      />
      <input type="hidden" name={name} value={selezionato?.id ?? ""} />
      {!selezionato && <p className="help">{help}</p>}
    </div>
  );
}
