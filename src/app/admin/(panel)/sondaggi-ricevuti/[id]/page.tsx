import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser, canManageSondaggi } from "@/lib/auth";
import { getStatisticheSondaggio } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function StatisticheSondaggioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!canManageSondaggi(user)) redirect("/admin");
  const { id } = await params;

  const stats = await getStatisticheSondaggio(id);
  if (!stats) notFound();

  return (
    <section>
      <header className="page-header">
        <Link href="/admin/sondaggi-ricevuti" className="help">← Sondaggi ricevuti</Link>
        <div className="page-header__row">
          <div>
            <h1>{stats.sondaggioTitolo}</h1>
            <p>{stats.totaleCompilazioni} risposte totali</p>
          </div>
        </div>
      </header>

      {stats.totaleCompilazioni === 0 ? (
        <div className="card empty">Nessuna risposta ancora ricevuta.</div>
      ) : stats.campi.length === 0 ? (
        <div className="card empty">Questo sondaggio non ha domande da riepilogare.</div>
      ) : (
        <div className="stat-domande">
          {stats.campi.map((c, idx) => (
            <div key={c.campoId ?? `orfano-${idx}`} className="card stat-domanda">
              <div className="stat-domanda__head">
                <h2>{c.etichetta}</h2>
                <span className="help">{c.risposteTotali} risposte</span>
              </div>

              {c.opzioni ? (
                c.opzioni.every((o) => o.conteggio === 0) ? (
                  <p className="help">Nessuna risposta a questa domanda.</p>
                ) : (
                  <div className="stat-barre">
                    {c.opzioni.map((o) => (
                      <div className="stat-barra" key={o.valore}>
                        <div className="stat-barra__label">
                          <span>{o.valore}</span>
                          <span className="help">
                            {o.conteggio} · {o.percentuale}%
                          </span>
                        </div>
                        <div className="stat-barra__track">
                          <div className="stat-barra__fill" style={{ width: `${o.percentuale}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (c.valori ?? []).length === 0 ? (
                <p className="help">Nessuna risposta a questa domanda.</p>
              ) : (
                <ul className="stat-risposte-testo">
                  {c.valori!.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
