"use client";

import { useState } from "react";
import { addGuidaMateriale } from "@/app/admin/actions";

export default function AddMaterialeForm({ guidaId }: { guidaId: string }) {
  const [tipo, setTipo] = useState("documento");

  return (
    <form action={addGuidaMateriale} className="form">
      <input type="hidden" name="guidaId" value={guidaId} />

      <div className="field--row">
        <div className="field">
          <label htmlFor="mat-titolo">Titolo materiale</label>
          <input
            id="mat-titolo"
            name="titolo"
            className="input"
            placeholder="Es. Manuale PDF, Video tutorial…"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="mat-tipo">Tipo</label>
          <select
            id="mat-tipo"
            name="tipo"
            className="select"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          >
            <option value="documento">📄 Documento (PDF / file)</option>
            <option value="link">🔗 Link esterno</option>
            <option value="video">🎬 Video (YouTube / Vimeo)</option>
          </select>
        </div>
      </div>

      {tipo === "documento" ? (
        <div className="field">
          <label htmlFor="mat-file">File</label>
          <input id="mat-file" name="file" type="file" className="input" required />
        </div>
      ) : (
        <div className="field">
          <label htmlFor="mat-url">
            {tipo === "video" ? "URL del video (YouTube, Vimeo…)" : "URL del link"}
          </label>
          <input
            id="mat-url"
            name="url"
            className="input"
            placeholder="https://…"
            required
          />
        </div>
      )}

      <div>
        <button type="submit" className="btn btn--primary">
          Aggiungi materiale
        </button>
      </div>
    </form>
  );
}
