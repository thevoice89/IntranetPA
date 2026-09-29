"use client";

import type { Contatto } from "@/types";
import ContattoField from "@/components/ui/ContattoField";

// Checkbox "Pubblica anche una notizia di Formazione in home", stesso
// meccanismo di PubblicaNotiziaCheckbox ma per il tipo comunicazione
// "formazione" invece di "ufficiale": nomi di campo distinti così i due
// checkbox possono convivere nello stesso form senza collisioni. Riusata dal
// form "Formazione dei colleghi per i colleghi" e dal form "Avvisi e
// opportunità formative" (vedi rispettivi saveGuida/salvaAvvisoFormazione).
export default function PubblicaNotiziaFormazioneCheckbox({ contatti }: { contatti: Contatto[] }) {
  return (
    <div className="notizia-blocco">
      <div className="field field--check" style={{ marginBottom: 0 }}>
        <input id="pubblicaNotiziaFormazione" name="pubblicaNotiziaFormazione" type="checkbox" />
        <label htmlFor="pubblicaNotiziaFormazione" style={{ color: "var(--text)" }}>
          📰 Pubblica anche una notizia in home (categoria Notizie Formazione)
        </label>
      </div>
      <div className="notizia-dettaglio">
        <ContattoField
          contatti={contatti}
          name="notiziaFormazioneAutoreContattoId"
          label="Autore della notizia (dalla rubrica)"
          help="Le comunicazioni richiedono un nominativo scelto dalla rubrica."
        />
        <div className="field">
          <label htmlFor="notiziaFormazioneTesto">Testo della notizia (facoltativo)</label>
          <textarea
            id="notiziaFormazioneTesto"
            name="notiziaFormazioneTesto"
            className="textarea"
            rows={3}
            placeholder="Se lasciato vuoto viene generato un testo automatico."
          />
        </div>
      </div>
    </div>
  );
}
