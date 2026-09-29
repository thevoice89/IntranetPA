import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { getSondaggiPubblicati } from "@/lib/data";
import { getCurrentUser, canManageSondaggi, canManageSondaggioItem } from "@/lib/auth";
import { EditButton } from "@/components/ui/EditButton";

export const dynamic = "force-dynamic";

export default async function SondaggiPage() {
  const [sondaggi, user] = await Promise.all([getSondaggiPubblicati(), getCurrentUser()]);
  const puoModificare = !!user && canManageSondaggi(user);

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>{ROUTES.sondaggi.label}</h1>
            <p>{ROUTES.sondaggi.description}</p>
          </div>
          {puoModificare && <EditButton href="/admin/sondaggi" />}
        </div>
      </header>

      {sondaggi.length === 0 ? (
        <div className="card empty">Nessun sondaggio disponibile al momento.</div>
      ) : (
        <div className="grid">
          {sondaggi.map((s) => (
            <div key={s.id} className={`card-slot${user && canManageSondaggioItem(user, s) ? " has-fab" : ""}`}>
              {user && canManageSondaggioItem(user, s) && (
                <EditButton href={`/admin/sondaggi?edit=${s.id}`} variant="fab" />
              )}
              <Link href={`/sondaggi/${s.id}`} className="card service-card">
                <span className="service-card__icon" aria-hidden>📊</span>
                <span className="service-card__name">{s.titolo}</span>
                <span className="service-card__desc">
                  {s.campi.length} domand{s.campi.length === 1 ? "a" : "e"}
                </span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
