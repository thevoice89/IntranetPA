"use client";

import { useState } from "react";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { caricaImmagineTesto } from "@/app/admin/actions";

// Corpo della comunicazione: editor ricco al posto della vecchia textarea.
// Il testo formattato non può essere inviato da un campo HTML normale, quindi
// vive nello stato e viaggia in un <input type="hidden"> — stesso schema della
// descrizione in ModuloEditor.
//
// Il contenuto iniziale arriva già in HTML dalla pagina (corpoComunicazioneHtml
// converte i corpi scritti quando il campo era testo semplice): RichTextEditor
// scrive `value` nel DOM solo al mount, quindi qui non serve altro — a
// rimontarlo quando si passa da una comunicazione all'altra ci pensa la key sul
// <form> della pagina.
export default function CorpoComunicazione({ defaultCorpo }: { defaultCorpo: string }) {
  const [corpo, setCorpo] = useState(defaultCorpo);

  async function caricaImmagine(file: File): Promise<string | null> {
    const dati = new FormData();
    dati.append("file", file);
    const esito = await caricaImmagineTesto(dati);
    if (esito.errore) {
      window.alert(esito.errore);
      return null;
    }
    return esito.url ?? null;
  }

  return (
    <>
      <input type="hidden" name="corpo" value={corpo} readOnly />
      <RichTextEditor
        value={defaultCorpo}
        onChange={setCorpo}
        onUploadImage={caricaImmagine}
        placeholder="Scrivi qui il testo della comunicazione…"
        ariaLabel="Corpo della comunicazione"
      />
    </>
  );
}
