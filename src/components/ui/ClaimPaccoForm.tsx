"use client";

import { useState } from "react";
import type { Contatto } from "@/types";
import ContattoField from "@/components/ui/ContattoField";

// "È tuo questo pacco?" — due bottoni, "Sì" rivela il selettore del nominativo
// (mai testo libero, stesso principio di ContattoField/Segnalazioni), "No" non
// fa nulla (nessuna dichiarazione da registrare). Reveal locale via useState:
// non serve una pagina/route separata solo per mostrare un campo in più.
export default function ClaimPaccoForm({
  contatti,
  action,
}: {
  contatti: Contatto[];
  action: (formData: FormData) => void;
}) {
  const [rivendica, setRivendica] = useState(false);

  if (!rivendica) {
    return (
      <div className="card" style={{ padding: "1.5rem" }}>
        <p style={{ fontWeight: 600, marginBottom: "1rem" }}>È tuo questo pacco?</p>
        <div className="admin-row__actions">
          <button type="button" className="btn btn--primary" onClick={() => setRivendica(true)}>
            Sì, è mio
          </button>
          <a href="/" className="btn btn--ghost">
            No, non è mio
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "1.5rem" }}>
      <p style={{ fontWeight: 600, marginBottom: "1rem" }}>Chi sei?</p>
      <form action={action} className="form">
        <ContattoField
          contatti={contatti}
          label="Il tuo nominativo"
          help="Scegli il tuo nominativo dall'elenco: la reception saprà chi è passato a ritirarlo."
        />
        <div>
          <button type="submit" className="btn btn--primary">Conferma, è mio</button>
          <button
            type="button"
            className="btn btn--ghost"
            style={{ marginLeft: "0.75rem" }}
            onClick={() => setRivendica(false)}
          >
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}
