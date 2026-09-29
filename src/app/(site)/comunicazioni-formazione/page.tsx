import { ROUTES } from "@/lib/routes";
import { getComunicazioni } from "@/lib/data";
import { getCurrentUser, canEditComunicazioneItem } from "@/lib/auth";
import { ComunicazioneCard } from "@/components/ui/ComunicazioneCard";

export const dynamic = "force-dynamic";

export default async function ComunicazioniFormazionePage() {
  const [items, user] = await Promise.all([
    getComunicazioni("formazione"),
    getCurrentUser(),
  ]);

  return (
    <section>
      <header className="page-header">
        <h1>{ROUTES.comunicazioniFormazione.label}</h1>
        <p>{ROUTES.comunicazioniFormazione.description}</p>
      </header>

      {items.length === 0 ? (
        <div className="card empty">Nessuna notizia di formazione al momento.</div>
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
