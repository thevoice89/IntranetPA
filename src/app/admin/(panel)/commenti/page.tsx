import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, canEdit, canEditAny } from "@/lib/auth";
import { listTuttiCommenti } from "@/lib/data";
import { removeCommento, markCommento } from "@/app/admin/actions";

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

export default async function AdminCommenti() {
  const user = await requireUser();
  if (!canEditAny(user)) redirect("/admin");

  const tutti = await listTuttiCommenti();
  const commenti = tutti.filter((cm) => canEdit(user, cm.comunicazioneTipo));
  const nonLetti = commenti.filter((cm) => !cm.letta).length;

  return (
    <section>
      <header className="page-header">
        <h1>Commenti</h1>
        <p>
          {commenti.length} commenti ricevuti sulle comunicazioni · {nonLetti} da leggere
        </p>
      </header>

      {commenti.length === 0 ? (
        <div className="card empty">Nessun commento ricevuto.</div>
      ) : (
        <ul className="comm-list">
          {commenti.map((cm) => (
            <li
              key={cm.id}
              className="card comm-item"
              style={!cm.letta ? { borderLeft: "3px solid var(--accent)" } : undefined}
            >
              <div className="comm-item__top">
                {!cm.letta && <span className="badge">Nuovo</span>}
                <Link href={`/comunicazioni/${cm.comunicazioneId}`} className="badge" target="_blank">
                  {cm.comunicazioneTitolo}
                </Link>
                <span className="comm-item__meta" style={{ margin: 0 }}>
                  <strong>{cm.autore}</strong>
                  <span>·</span>
                  <span>{formatDataOra(cm.creatoIl)}</span>
                </span>
              </div>
              <p style={{ whiteSpace: "pre-wrap", marginTop: "0.4rem" }}>{cm.testo}</p>
              <div className="admin-row__actions" style={{ marginTop: "0.8rem" }}>
                <form action={markCommento} className="inline-form">
                  <input type="hidden" name="id" value={cm.id} />
                  <input type="hidden" name="letta" value={(!cm.letta).toString()} />
                  <button type="submit" className="btn btn--ghost btn--sm">
                    {cm.letta ? "Segna come da leggere" : "Segna come letto"}
                  </button>
                </form>
                <form action={removeCommento} className="inline-form">
                  <input type="hidden" name="id" value={cm.id} />
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
