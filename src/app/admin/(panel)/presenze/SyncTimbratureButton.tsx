"use client";
import { useTransition } from "react";
import { syncPresenzeSicraweb, syncPresenzeSicrawebPoliziaLocale } from "@/app/admin/actions";

export default function SyncTimbratureButton({ poliziaLocale = false }: { poliziaLocale?: boolean }) {
  const [pending, startTransition] = useTransition();

  function handleSync() {
    startTransition(async () => {
      const r = poliziaLocale ? await syncPresenzeSicrawebPoliziaLocale() : await syncPresenzeSicraweb();
      if ("error" in r) {
        alert(`Errore sync timbrature: ${r.error}`);
        return;
      }
      const righe = [
        `Ruolo controllato: ${r.roster} persone, ${r.timbratureRicevute} timbrature ricevute da Sicraweb.`,
        `Marcati assenti: ${r.marcatiAssente.length}${r.marcatiAssente.length ? " (" + r.marcatiAssente.join(", ") + ")" : ""}`,
        `Saltati (assenza/smart già segnati a mano): ${r.saltatiManuale.length}`,
        `Rimossi (sync precedente, ora presenti): ${r.rimossiSyncPrecedente.length}`,
        `Non abbinati a un contatto rubrica: ${r.nonAbbinati.length}${r.nonAbbinati.length ? " (" + r.nonAbbinati.join(", ") + ")" : ""}`,
      ];
      alert(`Sync timbrature ${poliziaLocale ? "Polizia Locale " : ""}${r.data} completata.\n\n${righe.join("\n")}`);
      window.location.reload();
    });
  }

  return (
    <button onClick={handleSync} disabled={pending} className="btn btn--ghost btn--sm">
      {pending ? "Sincronizzazione…" : poliziaLocale ? "Sincronizza Polizia Locale (oggi)" : "Sincronizza da timbrature (oggi)"}
    </button>
  );
}
