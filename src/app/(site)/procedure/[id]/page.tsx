import Link from "next/link";
import { notFound } from "next/navigation";
import { getProcedura, getFaqByProcedura } from "@/lib/data";
import { getCurrentUser, canEditProcedure } from "@/lib/auth";
import { EditButton } from "@/components/ui/EditButton";

export const dynamic = "force-dynamic";

export default async function ProceduraDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const procedura = await getProcedura(id);
  if (!procedura || !procedura.pubblicato) notFound();
  const [user, faq] = await Promise.all([getCurrentUser(), getFaqByProcedura(id)]);

  return (
    <section>
      <header className="page-header">
        <Link href="/procedure" className="help">← Procedure</Link>
        <div className="page-header__row">
          <h1>{procedura.titolo}</h1>
          {user && canEditProcedure(user) && <EditButton href={`/admin/procedure?edit=${procedura.id}`} />}
        </div>
        <p>
          <span className="badge">{procedura.categoria}</span>
        </p>
      </header>

      {/* Scheda sintetica: FAQ (se presenti) · ufficio · referente */}
      <div className="scheda">
        {faq.length > 0 && (
          <div className="card scheda__item">
            <div className="scheda__label">FAQ</div>
            <div className="scheda__value">
              <a href="#faq">
                {faq.length} {faq.length === 1 ? "domanda frequente" : "domande frequenti"}
              </a>
            </div>
          </div>
        )}
        <div className="card scheda__item">
          <div className="scheda__label">Ufficio</div>
          <div className="scheda__value">{procedura.ufficioNome || "—"}</div>
        </div>
        <div className="card scheda__item">
          <div className="scheda__label">Referente</div>
          <div className="scheda__value">{procedura.referente || "—"}</div>
          {procedura.referenteContatto && (
            <div className="scheda__value scheda__value--muted">
              {procedura.referenteContatto}
            </div>
          )}
        </div>
      </div>

      {procedura.descrizione && (
        <div className="card" style={{ padding: "1.2rem", marginBottom: "1.25rem", whiteSpace: "pre-wrap" }}>
          {procedura.descrizione}
        </div>
      )}

      {procedura.url && (
        <a href={procedura.url} target="_blank" rel="noreferrer" className="btn btn--primary">
          Apri approfondimento ↗
        </a>
      )}

      {faq.length > 0 && (
        <>
          <div id="faq" className="section-title" style={{ marginTop: "1.75rem", scrollMarginTop: "1rem" }}>Domande frequenti</div>
          {faq.map((f) => (
            <details key={f.id} className="card" style={{ padding: "1rem 1.2rem", marginBottom: "0.6rem" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>{f.domanda}</summary>
              <div style={{ marginTop: "0.75rem", whiteSpace: "pre-wrap" }}>{f.risposta}</div>
            </details>
          ))}
        </>
      )}
    </section>
  );
}
