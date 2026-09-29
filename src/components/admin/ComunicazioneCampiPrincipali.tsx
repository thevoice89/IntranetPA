"use client";

import { useState } from "react";
import type { Contatto, TipoComunicazione, Ufficio } from "@/types";
import ContattoField from "@/components/ui/ContattoField";

const TIPO_LABEL: Record<TipoComunicazione, string> = {
  ufficiale: "Ufficiale",
  non_ufficiale: "Non ufficiale",
  rsu: "RSU",
  sicurezza: "Sicurezza sul lavoro",
  eventi: "Eventi",
  formazione: "Notizie Formazione",
};

// Tipo e Autore in un unico componente client: l'Autore delle comunicazioni
// ufficiali e RSU deve provenire dalla rubrica (mai testo libero, stesso
// principio del form pubblico delle non ufficiali — vedi ContattoField),
// mentre per le non ufficiali resta un campo di testo libero. Serve stato
// condiviso col <select> Tipo per decidere quale widget mostrare, quindi
// entrambi i campi vivono qui.
export function ComunicazioneCampiPrincipali({
  allowed,
  defaultTipo,
  uffici,
  defaultCategoria,
  categoriaStorica,
  contatti,
  defaultAutoreTesto,
  defaultContattoAutore,
  defaultData,
}: {
  allowed: TipoComunicazione[];
  defaultTipo: TipoComunicazione;
  uffici: Ufficio[];
  defaultCategoria: string;
  // Valorizzato solo se la categoria salvata non è più nell'elenco uffici
  // corrente: preserva il valore storico come opzione extra (vedi pagina admin).
  categoriaStorica: string | null;
  contatti: Contatto[];
  defaultAutoreTesto: string;
  defaultContattoAutore: Contatto | null;
  defaultData: string;
}) {
  const [tipo, setTipo] = useState<TipoComunicazione>(defaultTipo);

  return (
    <>
      <div className="field--row">
        <div className="field">
          <label htmlFor="tipo">Tipo</label>
          <select
            id="tipo"
            name="tipo"
            className="select"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoComunicazione)}
          >
            {allowed.map((t) => (
              <option key={t} value={t}>{TIPO_LABEL[t]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="categoria">Ufficio</label>
          <select id="categoria" name="categoria" className="select" defaultValue={defaultCategoria}>
            {categoriaStorica && (
              <option value={categoriaStorica}>
                {categoriaStorica} (non più nell&apos;elenco uffici)
              </option>
            )}
            {uffici.map((u) => (
              <option key={u.id} value={u.nome}>{u.nome}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field--row">
        <div className="field">
          {tipo === "rsu" ||
          tipo === "ufficiale" ||
          tipo === "sicurezza" ||
          tipo === "eventi" ||
          tipo === "formazione" ? (
            <ContattoField
              contatti={contatti}
              name="autoreContattoId"
              label="Autore (dalla rubrica)"
              help={
                tipo === "rsu"
                  ? "Le comunicazioni RSU richiedono un nominativo scelto dalla rubrica."
                  : tipo === "sicurezza"
                    ? "Le comunicazioni di Sicurezza sul lavoro richiedono un nominativo scelto dalla rubrica."
                    : tipo === "eventi"
                      ? "Le comunicazioni Eventi richiedono un nominativo scelto dalla rubrica."
                      : tipo === "formazione"
                        ? "Le comunicazioni di Notizie Formazione richiedono un nominativo scelto dalla rubrica."
                        : "Le comunicazioni ufficiali richiedono un nominativo scelto dalla rubrica."
              }
              defaultContatto={defaultContattoAutore}
            />
          ) : (
            <>
              <label htmlFor="autore">Autore</label>
              <input id="autore" name="autore" className="input" defaultValue={defaultAutoreTesto} />
            </>
          )}
        </div>
        <div className="field">
          <label htmlFor="data">Data</label>
          <input id="data" name="data" type="date" className="input" defaultValue={defaultData} />
        </div>
      </div>
    </>
  );
}
