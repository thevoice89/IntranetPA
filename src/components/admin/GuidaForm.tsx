"use client";

import type { Contatto, Guida } from "@/types";
import { saveGuida } from "@/app/admin/actions";
import PubblicaNotiziaFormazioneCheckbox from "@/components/admin/PubblicaNotiziaFormazioneCheckbox";
import ContattoField from "@/components/ui/ContattoField";

// Solo la notizia di Formazione (non anche PubblicaNotiziaCheckbox/"ufficiale"
// come in Procedure/Moduli): questa sezione è "Formazione dei colleghi per i
// colleghi", interamente di Formazione — un'unica scelta, come nel form
// gemello degli Avvisi (vedi formazione/avvisi/nuovo/page.tsx).
export function GuidaForm({
  guida,
  categorie = [],
  contatti = [],
  puoPubblicareNotiziaFormazione = false,
}: {
  guida: Guida | null;
  categorie?: string[];
  contatti?: Contatto[];
  puoPubblicareNotiziaFormazione?: boolean;
}) {
  const autoreAttuale = guida?.autoreContattoId
    ? contatti.find((c) => c.id === guida.autoreContattoId) ?? null
    : null;

  return (
    <form key={guida?.id ?? "new"} action={saveGuida} className="form">
      <input type="hidden" name="id" value={guida?.id ?? ""} />

      <div className="field--row">
        <div className="field">
          <label htmlFor="titolo">Titolo argomento</label>
          <input
            id="titolo"
            name="titolo"
            className="input"
            required
            placeholder="Es. Microsoft 365, Gestione presenze…"
            defaultValue={guida?.titolo ?? ""}
          />
        </div>
        <div className="field">
          <label htmlFor="categoria">Categoria</label>
          <input
            id="categoria"
            name="categoria"
            className="input"
            list="cat-guide"
            placeholder="Es. IT, HR, Sicurezza"
            defaultValue={guida?.categoria ?? ""}
          />
          <datalist id="cat-guide">
            {categorie.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="field">
        <label htmlFor="descrizione">Descrizione</label>
        <textarea
          id="descrizione"
          name="descrizione"
          className="textarea"
          rows={2}
          placeholder="Breve descrizione dell'argomento…"
          defaultValue={guida?.descrizione ?? ""}
        />
      </div>

      <ContattoField
        contatti={contatti}
        name="autoreContattoId"
        label="Condivisa da (facoltativo)"
        help="Il collega che ha messo a disposizione questa competenza — non necessariamente chi la sta inserendo qui."
        defaultContatto={autoreAttuale}
      />

      {!guida && puoPubblicareNotiziaFormazione && <PubblicaNotiziaFormazioneCheckbox contatti={contatti} />}

      <div>
        <button type="submit" className="btn btn--primary">
          {guida ? "Salva modifiche" : "Crea argomento"}
        </button>
      </div>
    </form>
  );
}
