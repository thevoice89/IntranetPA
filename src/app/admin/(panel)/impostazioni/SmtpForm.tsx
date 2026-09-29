"use client";

import { useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { salvaImpostazioniSmtp, inviaEmailProvaAction } from "@/app/admin/actions";

export interface SmtpValori {
  host: string;
  port: string;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn--primary" disabled={pending}>
      {pending ? "Salvataggio…" : "Salva impostazioni SMTP"}
    </button>
  );
}

// Un unico form: il pulsante "Salva" lo invia normalmente (action={salvaImpostazioniSmtp},
// con redirect); "Invia prova" invece legge gli stessi campi correnti (anche se non
// ancora salvati) con `new FormData(form)` e chiama l'azione direttamente dal client
// — "niente redirect, risultato mostrato inline" — così la
// prova verifica sempre quello che è scritto nel form in quel momento, non l'ultima
// configurazione salvata in precedenza (inviaEmailProvaAction salva comunque prima di
// testare, vedi app/admin/actions.ts).
export default function SmtpForm({ valori }: { valori: SmtpValori }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [esito, setEsito] = useState<{ ok?: boolean; error?: string } | null>(null);

  function handleTestClick() {
    if (!formRef.current) return;
    setEsito(null);
    const fd = new FormData(formRef.current);
    startTransition(async () => {
      setEsito(await inviaEmailProvaAction(fd));
    });
  }

  return (
    <form ref={formRef} action={salvaImpostazioniSmtp} className="form">
      <p className="help">
        Lascia i campi vuoti per usare le variabili d&apos;ambiente SMTP_* del server,
        se presenti.
      </p>

      <div className="field--row">
        <div className="field">
          <label htmlFor="smtpHost">Host</label>
          <input
            id="smtpHost"
            name="smtpHost"
            className="input"
            placeholder="smtp.esempio.it"
            defaultValue={valori.host}
          />
        </div>
        <div className="field">
          <label htmlFor="smtpPort">Porta</label>
          <input
            id="smtpPort"
            name="smtpPort"
            className="input"
            inputMode="numeric"
            placeholder="587"
            defaultValue={valori.port}
          />
        </div>
      </div>

      <div className="field field--check">
        <input id="smtpSecure" name="smtpSecure" type="checkbox" defaultChecked={valori.secure} />
        <label htmlFor="smtpSecure" style={{ color: "var(--text)" }}>
          Connessione sicura (SSL, tipicamente porta 465)
        </label>
      </div>

      <div className="field--row">
        <div className="field">
          <label htmlFor="smtpUser">Utente</label>
          <input
            id="smtpUser"
            name="smtpUser"
            className="input"
            autoComplete="off"
            defaultValue={valori.user}
          />
        </div>
        <div className="field">
          <label htmlFor="smtpPassword">Password</label>
          <input
            id="smtpPassword"
            name="smtpPassword"
            type="password"
            className="input"
            autoComplete="off"
            defaultValue={valori.password}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="smtpFrom">Mittente</label>
        <input
          id="smtpFrom"
          name="smtpFrom"
          type="email"
          className="input"
          placeholder="Se vuoto usa l'utente"
          defaultValue={valori.from}
        />
      </div>

      <SaveButton />

      <div className="card" style={{ padding: "1rem", background: "var(--surface-2)", marginTop: "0.25rem" }}>
        <div className="field--row" style={{ alignItems: "flex-end" }}>
          <div className="field">
            <label htmlFor="destinatarioProva">Invia un&apos;email di prova a</label>
            <input
              id="destinatarioProva"
              name="destinatarioProva"
              type="email"
              className="input"
              placeholder="tuo.indirizzo@esempio.it"
            />
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleTestClick}
            disabled={pending}
          >
            {pending ? "Invio…" : "Invia prova"}
          </button>
        </div>
        {esito?.ok && (
          <p className="help" style={{ color: "var(--accent)", marginTop: "0.6rem" }}>
            ✓ Email inviata correttamente.
          </p>
        )}
        {esito?.error && (
          <p className="help" style={{ color: "var(--off)", marginTop: "0.6rem" }}>
            ✕ {esito.error}
          </p>
        )}
      </div>
    </form>
  );
}
