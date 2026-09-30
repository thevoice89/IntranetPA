"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { caricaImmagineEnte, ripristinaImmagineEnte } from "@/app/admin/actions";

// Carica lo stemma o il logo dell'ente. Il browser legge l'immagine scelta (PNG,
// JPEG, WebP, GIF o SVG), la ridimensiona a `maxLato` px (mai ingrandendola) e la
// ricodifica in PNG, che è l'unico formato accettato dal server (vedi verificaPng in
// lib/branding.ts): l'utente non deve preparare il file, e il logo che finisce
// incorporato nei PDF resta leggero. Poi l'azione viene chiamata direttamente,
// senza redirect: l'esito appare qui sotto, come nel test dell'email in SmtpForm.

async function ridimensionaInPng(file: File, maxLato: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error("dimensioni non leggibili");
    const scala = Math.min(1, maxLato / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scala));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scala));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas non disponibile");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("conversione fallita"))), "image/png")
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ImmagineEnteForm({
  tipo,
  etichetta,
  descrizione,
  urlAttuale,
  personalizzata,
  maxLato,
}: {
  tipo: "stemma" | "logo";
  etichetta: string;
  descrizione: string;
  urlAttuale: string;
  personalizzata: boolean;
  maxLato: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [pronta, setPronta] = useState<{ blob: Blob; anteprima: string } | null>(null);
  const [esito, setEsito] = useState<{ ok?: boolean; error?: string } | null>(null);

  // Libera l'anteprima (object URL) quando ne arriva un'altra o il componente sparisce.
  useEffect(() => {
    return () => {
      if (pronta) URL.revokeObjectURL(pronta.anteprima);
    };
  }, [pronta]);

  async function handleScelta(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setEsito(null);
    setPronta(null);
    if (!file) return;
    try {
      const blob = await ridimensionaInPng(file, maxLato);
      setPronta({ blob, anteprima: URL.createObjectURL(blob) });
    } catch {
      setEsito({ error: "Non riesco a leggere questa immagine: prova con un file PNG o JPEG." });
    }
  }

  function azzera() {
    setPronta(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleCarica() {
    if (!pronta) return;
    const fd = new FormData();
    fd.set("tipo", tipo);
    fd.set("file", new File([pronta.blob], `${tipo}.png`, { type: "image/png" }));
    setEsito(null);
    startTransition(async () => {
      const risultato = await caricaImmagineEnte(fd);
      setEsito(risultato);
      if (risultato.ok) {
        azzera();
        router.refresh();
      }
    });
  }

  function handleRipristina() {
    if (!window.confirm(`Tornare al ${etichetta.toLowerCase()} predefinito?`)) return;
    setEsito(null);
    startTransition(async () => {
      const risultato = await ripristinaImmagineEnte(tipo);
      setEsito(risultato);
      if (risultato.ok) router.refresh();
    });
  }

  return (
    <div className="field">
      <label htmlFor={`immagine-${tipo}`}>{etichetta}</label>
      <p className="help" style={{ marginBottom: "0.6rem" }}>{descrizione}</p>

      <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", alignItems: "flex-start" }}>
        <div
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "0.75rem",
            minWidth: "9rem",
            textAlign: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pronta ? pronta.anteprima : urlAttuale}
            alt={pronta ? `Anteprima ${etichetta.toLowerCase()}` : `${etichetta} attuale`}
            style={{ maxWidth: "12rem", maxHeight: "8rem", display: "block", margin: "0 auto" }}
          />
          <div className="help" style={{ marginTop: "0.5rem" }}>
            {pronta ? "Anteprima (non ancora salvata)" : personalizzata ? "In uso" : "Predefinito"}
          </div>
        </div>

        <div style={{ flex: "1 1 16rem" }}>
          <input
            ref={inputRef}
            id={`immagine-${tipo}`}
            type="file"
            className="input"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            onChange={handleScelta}
            disabled={pending}
          />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleCarica}
              disabled={!pronta || pending}
            >
              {pending ? "Salvataggio…" : `Salva ${etichetta.toLowerCase()}`}
            </button>
            {personalizzata && (
              <button type="button" className="btn btn--ghost" onClick={handleRipristina} disabled={pending}>
                Ripristina predefinito
              </button>
            )}
          </div>
          {esito?.ok && (
            <p className="help" style={{ color: "var(--accent)", marginTop: "0.6rem" }}>
              ✓ {etichetta} aggiornato.
            </p>
          )}
          {esito?.error && (
            <p className="help" style={{ color: "var(--off)", marginTop: "0.6rem" }}>
              ✕ {esito.error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
