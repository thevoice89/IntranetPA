import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, canManageSondaggi } from "@/lib/auth";
import { getSondaggi, getCompilazioniSondaggi } from "@/lib/data";
import { markCompilazioneSondaggio, removeCompilazioneSondaggio } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

function formatDataOra(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
}

export default async function AdminSondaggiRicevuti({
  searchParams,
}: {
  searchParams: Promise<{ sondaggio?: string }>;
}) {
  const user = await requireUser();
  if (!canManageSondaggi(user)) redirect("/admin");
  const { sondaggio: sondaggioParam } = await searchParams;

  const sondaggi = await getSondaggi();
  // Il filtro va validato contro i sondaggi esistenti: non passarlo mai diretto in query.
  const sondaggioFiltro =
    sondaggioParam && sondaggi.some((s) => s.id === sondaggioParam) ? sondaggioParam : undefined;

  const compilazioni = await getCompilazioniSondaggi(sondaggioFiltro);
  const nonLette = compilazioni.filter((c) => !c.letta).length;
  // Se c'è un solo sondaggio non compaiono le tab per selezionarlo: in quel caso
  // le statistiche si riferiscono comunque sempre a quell'unico sondaggio.
  const sondaggioStatistiche =
    sondaggioFiltro ?? (sondaggi.length === 1 ? sondaggi[0].id : undefined);

  return (
    <section>
      <header className="page-header">
        <h1>Sondaggi ricevuti</h1>
        <p>
          {compilazioni.length} compilazioni · {nonLette} da leggere
        </p>
      </header>

      {sondaggi.length > 1 && (
        <div className="tabs">
          <Link href="/admin/sondaggi-ricevuti" className={`tab${!sondaggioFiltro ? " tab--active" : ""}`}>
            Tutti
          </Link>
          {sondaggi.map((s) => (
            <Link
              key={s.id}
              href={`/admin/sondaggi-ricevuti?sondaggio=${s.id}`}
              className={`tab${sondaggioFiltro === s.id ? " tab--active" : ""}`}
            >
              {s.titolo}
            </Link>
          ))}
        </div>
      )}

      {sondaggioStatistiche && (
        <div style={{ marginBottom: "1.25rem" }}>
          <Link href={`/admin/sondaggi-ricevuti/${sondaggioStatistiche}`} className="btn btn--ghost btn--sm">
            📊 Statistiche risposte
          </Link>
        </div>
      )}

      {compilazioni.length === 0 ? (
        <div className="card empty">Nessuna compilazione ricevuta.</div>
      ) : (
        <ul className="comm-list">
          {compilazioni.map((c) => (
            <li
              key={c.id}
              className="card comm-item"
              style={!c.letta ? { borderLeft: "3px solid var(--accent)" } : undefined}
            >
              <div className="comm-item__top">
                {!c.letta && <span className="badge">Nuovo</span>}
                <span className="comm-item__meta" style={{ margin: 0 }}>
                  <strong>{c.sondaggioTitolo}</strong>
                  <span>·</span>
                  <span>{c.nomeCompilatore || "Anonimo"}</span>
                  <span>·</span>
                  <span>{formatDataOra(c.creatoIl)}</span>
                </span>
              </div>

              {c.emailCompilatore && (
                <p className="help" style={{ marginTop: "0.3rem" }}>{c.emailCompilatore}</p>
              )}

              <dl style={{ marginTop: "0.6rem" }}>
                {c.risposte.map((r) => (
                  <div key={r.id} style={{ marginBottom: "0.5rem" }}>
                    <dt style={{ fontWeight: 600 }}>{r.etichetta}</dt>
                    <dd style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                      {r.allegato ? (
                        <a href={r.allegato.url} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm">
                          📎 {r.allegato.fileNameOriginale}
                        </a>
                      ) : (
                        r.valore || "—"
                      )}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="admin-row__actions" style={{ marginTop: "0.8rem" }}>
                <form action={markCompilazioneSondaggio} className="inline-form">
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="letta" value={(!c.letta).toString()} />
                  <button type="submit" className="btn btn--ghost btn--sm">
                    {c.letta ? "Segna come da leggere" : "Segna come letta"}
                  </button>
                </form>
                <form action={removeCompilazioneSondaggio} className="inline-form">
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="btn btn--danger btn--sm">Elimina</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
