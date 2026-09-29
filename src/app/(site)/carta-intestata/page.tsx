import { ROUTES } from "@/lib/routes";
import { getCarteIntestate } from "@/lib/data";
import { getCurrentUser, canEditCartaIntestata } from "@/lib/auth";
import { EditButton } from "@/components/ui/EditButton";
import { CartaIntestataLista } from "@/components/ui/CartaIntestataLista";

export const dynamic = "force-dynamic";

export default async function CartaIntestataPage() {
  const [elenco, user] = await Promise.all([getCarteIntestate(), getCurrentUser()]);

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>{ROUTES.cartaIntestata.label}</h1>
            <p>{ROUTES.cartaIntestata.description}</p>
          </div>
          {user && canEditCartaIntestata(user) && <EditButton href="/admin/carta-intestata" />}
        </div>
      </header>

      {elenco.length === 0 ? (
        <div className="card empty">Nessun file disponibile.</div>
      ) : (
        <CartaIntestataLista elenco={elenco} />
      )}
    </section>
  );
}
