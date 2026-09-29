"use client";

import type { Contatto } from "@/types";
import ContattoField from "@/components/ui/ContattoField";

// Checkbox "Pubblica anche una comunicazione ufficiale", riusata identica nei
// form di creazione di Procedure/Moduli/Guide (vedi saveProcedura/saveModulo/
// saveGuida in admin/actions.ts): la reveal del campo Autore è CSS puro
// (.notizia-blocco:has(input:checked), vedi globals.css), nessuno stato React
// necessario qui. Il chiamante decide se mostrarla (solo in creazione e solo
// se l'utente ha anche il permesso sulle comunicazioni ufficiali).
export default function PubblicaNotiziaCheckbox({ contatti }: { contatti: Contatto[] }) {
  return (
    <div className="notizia-blocco">
      <div className="field field--check" style={{ marginBottom: 0 }}>
        <input id="pubblicaNotizia" name="pubblicaNotizia" type="checkbox" />
        <label htmlFor="pubblicaNotizia" style={{ color: "var(--text)" }}>
          📰 Pubblica anche una comunicazione ufficiale che lo annuncia
        </label>
      </div>
      <div className="notizia-dettaglio">
        <ContattoField
          contatti={contatti}
          name="notiziaAutoreContattoId"
          label="Autore della comunicazione (dalla rubrica)"
          help="Le comunicazioni ufficiali richiedono un nominativo scelto dalla rubrica."
        />
        <div className="field">
          <label htmlFor="notiziaTesto">Testo della comunicazione (facoltativo)</label>
          <textarea
            id="notiziaTesto"
            name="notiziaTesto"
            className="textarea"
            rows={3}
            placeholder="Se lasciato vuoto viene generato un testo automatico."
          />
        </div>
      </div>
    </div>
  );
}
