import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { getComunicazioni } from "@/lib/data";
import { getCurrentUser, canEditComunicazioneItem } from "@/lib/auth";
import { ComunicazioneCard } from "@/components/ui/ComunicazioneCard";

export const dynamic = "force-dynamic";

export default async function ComunicazioniNonUfficialiPage() {
  const [items, user] = await Promise.all([
    getComunicazioni("non_ufficiale"),
    getCurrentUser(),
  ]);

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>{ROUTES.comunicazioniNonUfficiali.label}</h1>
            <p>{ROUTES.comunicazioniNonUfficiali.description}</p>
          </div>
          <Link href="/comunicazioni-non-ufficiali/nuova" className="btn btn--primary">
            + Nuova comunicazione
          </Link>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="card empty">Nessuna comunicazione in bacheca.</div>
      ) : (
        <ul className="comm-list">
          {items.map((c) => (
            <ComunicazioneCard
              key={c.id}
              comunicazione={c}
              editHref={user && canEditComunicazioneItem(user, c) ? `/admin/comunicazioni?edit=${c.id}` : undefined}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
