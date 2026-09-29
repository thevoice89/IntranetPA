import { ROUTES } from "@/lib/routes";
import { getComunicazioni } from "@/lib/data";
import { getCurrentUser, canEditComunicazioneItem } from "@/lib/auth";
import { ComunicazioneCard } from "@/components/ui/ComunicazioneCard";

export const dynamic = "force-dynamic";

export default async function ComunicazioniUfficialiPage({
  searchParams,
}: {
  searchParams: Promise<{ ufficio?: string }>;
}) {
  const { ufficio } = await searchParams;
  const [tutte, user] = await Promise.all([
    getComunicazioni("ufficiale"),
    getCurrentUser(),
  ]);
  const items = ufficio ? tutte.filter((c) => c.categoria === ufficio) : tutte;

  return (
    <section>
      <header className="page-header">
        <h1>{ROUTES.comunicazioniUfficiali.label}</h1>
        <p>{ufficio ? `Comunicazioni di ${ufficio}` : ROUTES.comunicazioniUfficiali.description}</p>
      </header>

      {items.length === 0 ? (
        <div className="card empty">
          {ufficio ? `Nessuna comunicazione di ${ufficio}.` : "Nessuna comunicazione ufficiale."}
        </div>
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
