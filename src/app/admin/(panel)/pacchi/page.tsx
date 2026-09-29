import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, canManagePacchi } from "@/lib/auth";
import { listPacchi } from "@/lib/data";
import { formatData } from "@/lib/format";
import { savePacco, removePacco } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const ERRORI: Record<string, string> = {
  dataArrivo: "Indica la data di arrivo del pacco.",
};

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

export default async function AdminPacchi({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  if (!canManagePacchi(user)) redirect("/admin");
  const { error } = await searchParams;
  const pacchi = await listPacchi();
  const inAttesa = pacchi.filter((p) => !p.rivendicatoIl).length;

  return (
    <section>
      <header className="page-header">
        <h1>Di chi è?</h1>
        <p>
          Registra un pacco arrivato senza destinatario chiaro: comparirà in home finché
          qualcuno non dichiara che è suo. {pacchi.length} pacchi · {inAttesa} in attesa
        </p>
      </header>

      {error && <div className="alert">{ERRORI[error] ?? "Controlla i dati inseriti e riprova."}</div>}

      {/* --- Form nuovo pacco --- */}
      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: "1.1rem" }}>Nuovo pacco</h2>
        <form action={savePacco} className="form" encType="multipart/form-data">
          <div className="field--row">
            <div className="field">
              <label htmlFor="dataArrivo">Data di arrivo</label>
              <input
                id="dataArrivo"
                name="dataArrivo"
                type="date"
                className="input"
                required
                defaultValue={new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" })}
              />
            </div>
            <div className="field">
              <label htmlFor="mittente">Mittente</label>
              <input id="mittente" name="mittente" className="input" placeholder="es. Amazon, corriere BRT…" />
            </div>
          </div>

          <div className="field">
            <label htmlFor="descrizione">Descrizione del pacco</label>
            <textarea
              id="descrizione"
              name="descrizione"
              className="textarea"
              rows={3}
              placeholder="es. Scatola marrone di medie dimensioni, nessun nome leggibile sull'etichetta…"
            />
          </div>

          <div className="field">
            <label htmlFor="foto">Foto (facoltativa)</label>
            <input id="foto" name="foto" type="file" accept="image/*" className="input" />
          </div>

          <div>
            <button type="submit" className="btn btn--primary">Registra pacco</button>
          </div>
        </form>
      </div>

      {/* --- Elenco --- */}
      {pacchi.length === 0 ? (
        <div className="card empty">Nessun pacco registrato.</div>
      ) : (
        <ul className="admin-list">
          {pacchi.map((p) => (
            <li key={p.id} className="card admin-row">
              {p.hasFoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/pacco-foto/${p.id}`}
                  alt=""
                  style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                />
              )}
              <div className="admin-row__main">
                <div className="admin-row__title">
                  {p.mittente || "Mittente non indicato"}{" "}
                  {p.rivendicatoIl ? (
                    <span className="badge">Assegnato</span>
                  ) : (
                    <span className="badge">In attesa</span>
                  )}
                </div>
                <div className="admin-row__sub">
                  Arrivato il {formatData(p.dataArrivo)}
                  {p.descrizione && ` · ${p.descrizione}`}
                </div>
                {p.rivendicatoIl && (
                  <div className="admin-row__sub">
                    Dichiarato da {p.rivendicatoNome} il {formatDataOra(p.rivendicatoIl)}
                  </div>
                )}
              </div>
              <div className="admin-row__actions">
                {!p.rivendicatoIl && (
                  <Link href={`/di-chi-e/${p.id}`} target="_blank" className="btn btn--ghost btn--sm">
                    Vedi scheda ↗
                  </Link>
                )}
                <form action={removePacco} className="inline-form">
                  <input type="hidden" name="id" value={p.id} />
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
