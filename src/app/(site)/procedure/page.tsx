import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { getProcedurePubblicate } from "@/lib/data";
import { getCurrentUser, canEditProcedure } from "@/lib/auth";
import { EditButton } from "@/components/ui/EditButton";
import type { Procedura } from "@/types";

export const dynamic = "force-dynamic";

export default async function ProcedurePage() {
  const [procedure, user] = await Promise.all([getProcedurePubblicate(), getCurrentUser()]);
  // Stesso permesso di /admin/procedure: prima la matita compariva a chiunque
  // fosse loggato, e chi non aveva il permesso veniva rimandato alla dashboard.
  const puoModificare = !!user && canEditProcedure(user);

  // Raggruppa per categoria.
  const perCategoria = new Map<string, Procedura[]>();
  for (const p of procedure) {
    const list = perCategoria.get(p.categoria) ?? [];
    list.push(p);
    perCategoria.set(p.categoria, list);
  }

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>{ROUTES.procedure.label}</h1>
            <p>{ROUTES.procedure.description}</p>
          </div>
          {puoModificare && <EditButton href="/admin/procedure" />}
        </div>
      </header>

      {procedure.length === 0 ? (
        <div className="card empty">Nessuna procedura disponibile.</div>
      ) : (
        [...perCategoria.entries()].map(([categoria, items]) => (
          <div key={categoria}>
            <div className="section-title">{categoria}</div>
            <div className="grid">
              {items.map((p) => (
                <div key={p.id} className={`card-slot${puoModificare ? " has-fab" : ""}`}>
                  {puoModificare && (
                    <EditButton href={`/admin/procedure?edit=${p.id}`} variant="fab" />
                  )}
                  <Link href={`/procedure/${p.id}`} className="card service-card">
                    <span className="service-card__icon" aria-hidden>🗂️</span>
                    <span className="service-card__name">{p.titolo}</span>
                    <span className="service-card__foot">
                      <span className="service-card__cat">{p.ufficioNome || p.servizio}</span>
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
