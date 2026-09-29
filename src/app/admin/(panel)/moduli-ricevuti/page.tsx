import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getModuliPerUffici, getCompilazioniPerUffici, listUffici } from "@/lib/data";
import { espandiConDiscendenti } from "@/lib/uffici-tree";
import { markCompilazione, removeCompilazione } from "@/app/admin/actions";

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

export default async function AdminModuliRicevuti({
  searchParams,
}: {
  searchParams: Promise<{ modulo?: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.ruolo === "admin";
  const { modulo: moduloParam } = await searchParams;

  // Cascata: gli uffici "propri" di un editor sono quelli assegnati più tutti i discendenti.
  const ufficiPropri = isAdmin ? null : espandiConDiscendenti(user.uffici, await listUffici());
  const moduliAccessibili = await getModuliPerUffici(ufficiPropri);
  // Il filtro va validato contro gli uffici dell'utente: non passarlo mai diretto in query.
  const moduloFiltro =
    moduloParam && moduliAccessibili.some((m) => m.id === moduloParam)
      ? moduloParam
      : undefined;

  const compilazioni = await getCompilazioniPerUffici(ufficiPropri, moduloFiltro);
  const nonLette = compilazioni.filter((c) => !c.letta).length;
  // Se c'è un solo modulo accessibile non compaiono le tab per selezionarlo:
  // in quel caso le statistiche si riferiscono comunque sempre a quell'unico modulo.
  const moduloStatistiche =
    moduloFiltro ?? (moduliAccessibili.length === 1 ? moduliAccessibili[0].id : undefined);

  return (
    <section>
      <header className="page-header">
        <h1>Moduli ricevuti</h1>
        <p>
          {compilazioni.length} compilazioni · {nonLette} da leggere
        </p>
      </header>

      {moduliAccessibili.length > 1 && (
        <div className="tabs">
          <Link href="/admin/moduli-ricevuti" className={`tab${!moduloFiltro ? " tab--active" : ""}`}>
            Tutti
          </Link>
          {moduliAccessibili.map((m) => (
            <Link
              key={m.id}
              href={`/admin/moduli-ricevuti?modulo=${m.id}`}
              className={`tab${moduloFiltro === m.id ? " tab--active" : ""}`}
            >
              {m.titolo}
            </Link>
          ))}
        </div>
      )}

      {moduloStatistiche && (
        <div style={{ marginBottom: "1.25rem" }}>
          <Link href={`/admin/moduli-ricevuti/${moduloStatistiche}`} className="btn btn--ghost btn--sm">
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
                  <strong>{c.moduloTitolo}</strong>
                  <span>·</span>
                  <span>{c.ufficioNome}</span>
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
                <a
                  href={`/api/moduli-compilazione-pdf/${c.id}`}
                  className="btn btn--ghost btn--sm"
                >
                  📄 Scarica PDF
                </a>
                <form action={markCompilazione} className="inline-form">
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="letta" value={(!c.letta).toString()} />
                  <button type="submit" className="btn btn--ghost btn--sm">
                    {c.letta ? "Segna come da leggere" : "Segna come letta"}
                  </button>
                </form>
                <form action={removeCompilazione} className="inline-form">
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
