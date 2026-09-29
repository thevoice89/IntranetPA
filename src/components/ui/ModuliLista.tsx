"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EditButton } from "@/components/ui/EditButton";
import type { Modulo } from "@/types";

// Un modulo "documento" (file già pronto da scaricare, niente domande) è
// segnalato col colore verde di --ok e l'icona 📄, per distinguerlo a colpo
// d'occhio da un "form" (domande online, icona 📝, colore di default).
function ModuloCard({ m, puoModificare }: { m: Modulo; puoModificare: boolean }) {
  const isDocumento = m.tipo === "documento";
  // Una bozza (non ancora pubblicata) compare qui solo a chi può gestirla
  // (vedi il filtro in (site)/moduli/page.tsx): non ha una pagina pubblica
  // raggiungibile (404 finché non è pubblicata, vedi (site)/moduli/[id]/
  // page.tsx), quindi l'intera card porta all'editor invece che al dettaglio,
  // e non serve una matita separata sopra.
  const isBozza = !m.pubblicato;
  const icona = isBozza ? "✏️" : isDocumento ? "📄" : m.tipo === "pdf" ? "🖨️" : "📝";
  const href = isBozza ? `/admin/moduli?edit=${m.id}` : `/moduli/${m.id}`;
  return (
    <div className={`card-slot${puoModificare && !isBozza ? " has-fab" : ""}`}>
      {puoModificare && !isBozza && <EditButton href={`/admin/moduli?edit=${m.id}`} variant="fab" />}
      <Link
        href={href}
        className={`card service-card${isDocumento ? " service-card--documento" : ""}`}
      >
        <span className="service-card__icon" aria-hidden>{icona}</span>
        <span className="service-card__name">
          {m.titolo}
          {isBozza && <span className="badge" style={{ marginLeft: "0.4rem" }}>bozza</span>}
        </span>
        <span className="service-card__foot">
          <span className="service-card__cat">{m.ufficioNome}</span>
        </span>
      </Link>
    </div>
  );
}

// Filtro istantaneo lato client, stesso pattern di RubricaTavola/CartaIntestataLista:
// elenco corto, non serve una ricerca server-side. `permessiModifica` arriva già
// calcolato dal server (canManageModuloItem tocca lib/auth, non importabile in un
// client component).
export function ModuliLista({
  moduli,
  permessiModifica,
}: {
  moduli: Modulo[];
  permessiModifica: Set<string>;
}) {
  const [q, setQ] = useState("");

  const filtrati = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return moduli;
    return moduli.filter((m) =>
      [m.titolo, m.descrizione, m.ufficioNome].join(" ").toLowerCase().includes(term)
    );
  }, [q, moduli]);

  const perUfficio = useMemo(() => {
    const map = new Map<string, Modulo[]>();
    for (const m of filtrati) {
      const list = map.get(m.ufficioNome) ?? [];
      list.push(m);
      map.set(m.ufficioNome, list);
    }
    return [...map.entries()];
  }, [filtrati]);

  return (
    <>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍  Cerca per titolo, ufficio…"
        className="input"
        style={{ marginBottom: "1.5rem", maxWidth: 520 }}
        aria-label="Cerca nei moduli"
      />

      {filtrati.length === 0 ? (
        <div className="card empty">Nessun modulo trovato.</div>
      ) : (
        perUfficio.map(([ufficio, items]) => {
          const daCompilare = items.filter((m) => m.tipo !== "documento");
          const daScaricare = items.filter((m) => m.tipo === "documento");
          // La sotto-etichetta compare solo quando in questo ufficio ci sono
          // entrambi i tipi: altrimenti sarebbe rumore ripetuto per niente.
          const mostraSottosezioni = daCompilare.length > 0 && daScaricare.length > 0;

          return (
            <div key={ufficio}>
              <div className="section-title">{ufficio}</div>

              {daCompilare.length > 0 && (
                <>
                  {mostraSottosezioni && (
                    <div className="subsection-title">📝 Da compilare online</div>
                  )}
                  <div className="grid">
                    {daCompilare.map((m) => (
                      <ModuloCard key={m.id} m={m} puoModificare={permessiModifica.has(m.id)} />
                    ))}
                  </div>
                </>
              )}

              {daScaricare.length > 0 && (
                <>
                  {mostraSottosezioni && (
                    <div className="subsection-title subsection-title--documento">📄 Documenti da scaricare</div>
                  )}
                  <div className="grid">
                    {daScaricare.map((m) => (
                      <ModuloCard key={m.id} m={m} puoModificare={permessiModifica.has(m.id)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })
      )}
    </>
  );
}
