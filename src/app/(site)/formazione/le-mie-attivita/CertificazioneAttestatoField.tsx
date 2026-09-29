"use client";

import { useState } from "react";

// Checkbox e campo file uniti in un solo componente perché il secondo dipende
// dal primo: se si dichiara la certificazione delle competenze, l'attestato
// diventa obbligatorio — a meno che non ce ne sia già uno caricato in
// precedenza (in modifica, non lo si deve ricaricare ad ogni salvataggio). Il
// controllo lato client è solo un aiuto immediato: quello vero, che non si
// può aggirare disattivando il JS, resta in salvaAttivitaFormazione.
export default function CertificazioneAttestatoField({
  defaultChecked,
  attestatoUrl,
  attestatoNomeOriginale,
}: {
  defaultChecked: boolean;
  attestatoUrl: string | null;
  attestatoNomeOriginale: string | null;
}) {
  const [certificazione, setCertificazione] = useState(defaultChecked);
  const obbligatorio = certificazione && !attestatoUrl;

  return (
    <>
      <div className="field field--check">
        <input
          id="certificazioneCompetenze"
          name="certificazioneCompetenze"
          type="checkbox"
          checked={certificazione}
          onChange={(e) => setCertificazione(e.target.checked)}
        />
        <label htmlFor="certificazioneCompetenze">Certificazione competenze</label>
      </div>

      <div className="field">
        <label htmlFor="attestato">
          Attestato {obbligatorio ? "(obbligatorio con la certificazione competenze)" : "(facoltativo)"}
        </label>
        {attestatoUrl && (
          <p className="help" style={{ marginBottom: "0.4rem" }}>
            Attuale:{" "}
            <a href={attestatoUrl} target="_blank" rel="noreferrer">
              {attestatoNomeOriginale}
            </a>{" "}
            — carica un nuovo file per sostituirlo.
          </p>
        )}
        <input
          id="attestato"
          name="attestato"
          type="file"
          className="input"
          accept=".pdf,image/*"
          required={obbligatorio}
        />
      </div>
    </>
  );
}
