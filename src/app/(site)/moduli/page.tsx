import { ROUTES } from "@/lib/routes";
import { getModuliPubblicati, getModuliPerUffici, listUffici } from "@/lib/data";
import { getCurrentUser, canManageModuloItem, canManageAnyUfficio } from "@/lib/auth";
import { espandiConDiscendenti } from "@/lib/uffici-tree";
import { EditButton } from "@/components/ui/EditButton";
import { ModuliLista } from "@/components/ui/ModuliLista";

export const dynamic = "force-dynamic";

export default async function ModuliPage() {
  const [pubblicati, user, uffici] = await Promise.all([
    getModuliPubblicati(),
    getCurrentUser(),
    listUffici(),
  ]);

  // Le proprie bozze (non ancora pubblicate) compaiono qui insieme ai moduli
  // pubblicati, con badge "bozza" (vedi ModuloCard in ModuliLista.tsx):
  // altrimenti chi le crea non le vede da nessuna parte finché non pubblica.
  // AdminModuli non ha più un elenco proprio e rimanda qui (vedi
  // admin/(panel)/moduli/page.tsx): questo è l'unico elenco, con la matita
  // per chi ha anche il permesso di modifica.
  let moduli = pubblicati;
  if (user && canManageAnyUfficio(user)) {
    const isAdmin = user.ruolo === "admin";
    const ufficiPropri = isAdmin ? null : espandiConDiscendenti(user.uffici, uffici);
    const propri = await getModuliPerUffici(ufficiPropri);
    const idPubblicati = new Set(pubblicati.map((m) => m.id));
    const bozzeProprie = propri.filter(
      (m) => !m.pubblicato && !idPubblicati.has(m.id) && canManageModuloItem(user, m, uffici)
    );
    if (bozzeProprie.length > 0) moduli = [...moduli, ...bozzeProprie];
  }

  // Stesso controllo di /admin/moduli?edit=: permesso sull'ufficio e, per chi
  // non è admin, essere chi ha creato il modulo. Col solo permesso sull'ufficio
  // la matita compariva anche sui moduli dei colleghi e apriva un modulo vuoto.
  const permessiModifica = new Set(
    user ? moduli.filter((m) => canManageModuloItem(user, m, uffici)).map((m) => m.id) : []
  );

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>{ROUTES.moduli.label}</h1>
            <p>{ROUTES.moduli.description}</p>
          </div>
          {user && canManageAnyUfficio(user) && <EditButton href="/admin/moduli?nuovo=1" />}
        </div>
      </header>

      {moduli.length === 0 ? (
        <div className="card empty">Nessun modulo disponibile.</div>
      ) : (
        <ModuliLista moduli={moduli} permessiModifica={permessiModifica} />
      )}
    </section>
  );
}
