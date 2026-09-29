import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, canEditRubrica } from "@/lib/auth";
import { getContatti, getContatto, listUffici } from "@/lib/data";
import { saveContatto, removeContatto } from "@/app/admin/actions";
import UfficiMultiPicker from "@/components/admin/UfficiMultiPicker";
import RubricaAdminLista from "./RubricaAdminLista";

export const dynamic = "force-dynamic";

export default async function AdminRubrica({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; nuovo?: string }>;
}) {
  const user = await requireUser();
  if (!canEditRubrica(user)) redirect("/admin");
  const { edit, nuovo } = await searchParams;
  // Il modulo compare solo su richiesta esplicita (matita o "+ Nuovo
  // contatto"): altrimenti, arrivando qui da loggati, si vedrebbe sempre un
  // modulo aperto in creazione anche senza aver chiesto di creare/modificare.
  const inFormMode = Boolean(edit) || nuovo === "1";
  const [contatti, uffici] = await Promise.all([getContatti(), listUffici()]);
  const inModifica = edit ? await getContatto(edit) : null;

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>Rubrica</h1>
            <p>Contatti interni: nome, ufficio, interno, telefono ed email.</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            {inFormMode ? (
              <Link href="/admin/rubrica" className="btn btn--ghost btn--sm">
                ← Torna all&apos;elenco
              </Link>
            ) : (
              <Link href="/admin/rubrica?nuovo=1" className="btn btn--primary btn--sm">
                + Nuovo contatto
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* --- Form crea/modifica (solo su richiesta, vedi inFormMode sopra) --- */}
      {inFormMode && (
      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: "1.1rem" }}>
          {inModifica ? `Modifica: ${inModifica.nome}` : "Nuovo contatto"}
        </h2>
        <form action={saveContatto} className="form">
          <input type="hidden" name="id" value={inModifica?.id ?? ""} />
          <input type="hidden" name="fonte" value={inModifica?.fonte ?? "manuale"} />

          <div className="field">
            <label htmlFor="nome">Nome e cognome</label>
            <input id="nome" name="nome" className="input" required defaultValue={inModifica?.nome ?? ""} />
          </div>

          <UfficiMultiPicker
            key={inModifica?.id ?? "nuovo"}
            uffici={uffici}
            defaultUfficiIds={inModifica?.uffici.map((u) => u.id) ?? []}
            label="Uffici"
          />

          <div className="field--row">
            <div className="field">
              <label htmlFor="ruolo">Ruolo / mansione</label>
              <input id="ruolo" name="ruolo" className="input" defaultValue={inModifica?.ruolo ?? ""} />
            </div>
            <div className="field">
              <label htmlFor="interno">Interno</label>
              <input id="interno" name="interno" className="input" placeholder="Es. 201" defaultValue={inModifica?.interno ?? ""} />
            </div>
          </div>

          <div className="field--row">
            <div className="field">
              <label htmlFor="telefono">Telefono diretto</label>
              <input id="telefono" name="telefono" className="input" defaultValue={inModifica?.telefono ?? ""} />
            </div>
            <div className="field">
              <label htmlFor="cellulare">Cellulare</label>
              <input id="cellulare" name="cellulare" className="input" defaultValue={inModifica?.cellulare ?? ""} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" className="input" defaultValue={inModifica?.email ?? ""} />
          </div>

          <div className="field">
            <label htmlFor="note">Note</label>
            <input id="note" name="note" className="input" defaultValue={inModifica?.note ?? ""} />
          </div>

          <div>
            <button type="submit" className="btn btn--primary">
              {inModifica ? "Salva modifiche" : "Crea contatto"}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* --- Elenco (nascosto mentre si crea/modifica, vedi inFormMode sopra) --- */}
      {!inFormMode && (
        contatti.length === 0 ? (
          <div className="card empty">Nessun contatto.</div>
        ) : (
          <RubricaAdminLista contatti={contatti} removeContatto={removeContatto} />
        )
      )}
    </section>
  );
}
