import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, canManageSondaggi, canManageSondaggioItem } from "@/lib/auth";
import { getSondaggi, getSondaggio } from "@/lib/data";
import { removeSondaggio } from "@/app/admin/actions";
import SondaggioEditor from "@/components/admin/SondaggioEditor";

export const dynamic = "force-dynamic";

export default async function AdminSondaggi({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; nuovo?: string }>;
}) {
  const user = await requireUser();
  if (!canManageSondaggi(user)) redirect("/admin");
  const { edit, nuovo } = await searchParams;
  // L'editor compare solo su richiesta esplicita (matita o "+ Nuovo sondaggio"):
  // altrimenti, arrivando qui da loggati, si vedrebbe sempre un sondaggio
  // aperto in creazione anche senza aver chiesto di creare o modificare nulla.
  const inFormMode = Boolean(edit) || nuovo === "1";

  const sondaggi = await getSondaggi();
  const candidato = edit ? await getSondaggio(edit) : null;
  const inModifica = candidato && canManageSondaggioItem(user, candidato) ? candidato : null;

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>Sondaggi</h1>
            <p>Struttura identica ai Moduli. Quelli pubblicati sono visibili a tutti in /sondaggi.</p>
          </div>
          {inFormMode ? (
            <Link href="/admin/sondaggi" className="btn btn--ghost btn--sm">
              ← Torna all&apos;elenco
            </Link>
          ) : (
            <Link href="/admin/sondaggi?nuovo=1" className="btn btn--primary btn--sm">
              + Nuovo sondaggio
            </Link>
          )}
        </div>
      </header>

      {inFormMode && <SondaggioEditor key={inModifica?.id ?? "new"} sondaggio={inModifica} />}

      {!inFormMode && (
        sondaggi.length === 0 ? (
          <div className="card empty">Nessun sondaggio.</div>
        ) : (
          <ul className="admin-list">
            {sondaggi.map((s) => (
              <li key={s.id} className="card admin-row">
                <div className="admin-row__main">
                  <div className="admin-row__title">
                    {s.titolo}{" "}
                    {!s.pubblicato && <span className="badge">bozza</span>}
                  </div>
                  <div className="admin-row__sub">
                    {s.campi.length} domand{s.campi.length === 1 ? "a" : "e"}
                  </div>
                </div>
                {canManageSondaggioItem(user, s) && (
                  <div className="admin-row__actions">
                    <Link href={`/admin/sondaggi?edit=${s.id}`} className="btn btn--ghost btn--sm">
                      Modifica
                    </Link>
                    <form action={removeSondaggio} className="inline-form">
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" className="btn btn--danger btn--sm">
                        Elimina
                      </button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}
