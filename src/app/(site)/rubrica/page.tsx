import { ROUTES } from "@/lib/routes";
import { getContatti } from "@/lib/data";
import { getCurrentUser, canEditRubrica } from "@/lib/auth";
import { EditButton } from "@/components/ui/EditButton";
import { RubricaTavola } from "@/components/ui/RubricaTavola";

export const dynamic = "force-dynamic";

export default async function RubricaPage() {
  const [contatti, user] = await Promise.all([getContatti(), getCurrentUser()]);
  // Stesso permesso di /admin/rubrica: matita e colonna azioni solo a chi può
  // davvero modificare, non a chiunque sia loggato.
  const puoModificare = !!user && canEditRubrica(user);

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>{ROUTES.rubrica.label}</h1>
            <p>{ROUTES.rubrica.description}</p>
          </div>
          {puoModificare && <EditButton href="/admin/rubrica" />}
        </div>
      </header>

      {contatti.length === 0 ? (
        <div className="card empty">Nessun contatto in rubrica.</div>
      ) : (
        <RubricaTavola contatti={contatti} isAdmin={puoModificare} />
      )}
    </section>
  );
}
