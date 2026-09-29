import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getSala, listBlocchiSala } from "@/lib/data";
import { rimuoviBloccoSala } from "@/app/admin/actions";
import { oggiIso as oggiIsoRoma } from "@/lib/format";
import BloccaSlotApp from "./BloccaSlotApp";

export const dynamic = "force-dynamic";

function formatDataItaliana(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default async function AdminBloccaSala({
  params,
  searchParams,
}: {
  params: Promise<{ salaId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const { salaId } = await params;
  const { ok, error } = await searchParams;

  const sala = await getSala(salaId);
  if (!sala) notFound();

  const blocchi = await listBlocchiSala(salaId);

  const oggiIso = oggiIsoRoma();

  return (
    <section>
      <header className="page-header">
        <Link href="/admin/prenotazioni-sale" className="help">← Prenotazione sale</Link>
        <div className="page-header__row">
          <div>
            <h1>Blocca orari — {sala.nome}</h1>
            <p>Seleziona nel calendario gli orari da rendere non prenotabili, senza indicare un motivo.</p>
          </div>
        </div>
      </header>

      {ok && <div className="notice notice--ok">Orari bloccati.</div>}
      {error === "blocco" && (
        <div className="alert" style={{ marginBottom: "1rem" }}>
          Seleziona almeno un orario prima di confermare.
        </div>
      )}

      <div className="card" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
        <BloccaSlotApp salaId={sala.id} salaNome={sala.nome} oggiIso={oggiIso} />
      </div>

      <h2 style={{ fontSize: "1.05rem", marginBottom: "0.9rem" }}>Orari già bloccati</h2>
      {blocchi.length === 0 ? (
        <div className="card empty">Nessun orario bloccato per questa sala.</div>
      ) : (
        <ul className="admin-list">
          {blocchi.map((b) => {
            const passato = b.data < oggiIso;
            return (
              <li key={b.id} className="card admin-row" style={passato ? { opacity: 0.6 } : undefined}>
                <div className="admin-row__main">
                  <div className="admin-row__title">
                    {formatDataItaliana(b.data)} · dalle {b.oraInizio} alle {b.oraFine}
                  </div>
                </div>
                <form action={rimuoviBloccoSala} className="inline-form">
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="salaId" value={sala.id} />
                  <button type="submit" className="btn btn--danger btn--sm">Elimina</button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
