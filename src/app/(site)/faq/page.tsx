import { getFaqPubblicate } from "@/lib/data";
import { getCurrentUser, canEditProcedure } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { EditButton } from "@/components/ui/EditButton";
import type { Faq } from "@/types";

export const dynamic = "force-dynamic";

export default async function FaqPage() {
  const [faq, user] = await Promise.all([getFaqPubblicate(), getCurrentUser()]);

  // Raggruppa per categoria, stesso pattern di /procedure.
  const perCategoria = new Map<string, Faq[]>();
  for (const f of faq) {
    const list = perCategoria.get(f.categoria) ?? [];
    list.push(f);
    perCategoria.set(f.categoria, list);
  }

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>{ROUTES.faq.label}</h1>
            <p>{ROUTES.faq.description}</p>
          </div>
          {user && canEditProcedure(user) && <EditButton href="/admin/faq" />}
        </div>
      </header>

      {faq.length === 0 ? (
        <div className="card empty">Nessuna FAQ disponibile.</div>
      ) : (
        [...perCategoria.entries()].map(([categoria, items]) => (
          <div key={categoria}>
            <div className="section-title">{categoria}</div>
            {items.map((f) => (
              <details key={f.id} className="card" style={{ padding: "1rem 1.2rem", marginBottom: "0.6rem" }}>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>{f.domanda}</summary>
                <div style={{ marginTop: "0.75rem", whiteSpace: "pre-wrap" }}>{f.risposta}</div>
                {f.proceduraId && (
                  <a href={`/procedure/${f.proceduraId}`} className="help" style={{ display: "inline-block", marginTop: "0.6rem" }}>
                    Vedi la procedura collegata: {f.proceduraTitolo} →
                  </a>
                )}
              </details>
            ))}
          </div>
        ))
      )}
    </section>
  );
}
