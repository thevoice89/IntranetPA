import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, canManageModuloItem, canEdit } from "@/lib/auth";
import { listUffici, getModulo, getContatti } from "@/lib/data";
import { espandiConDiscendenti } from "@/lib/uffici-tree";
import ModuloEditor from "@/components/admin/ModuloEditor";

export const dynamic = "force-dynamic";

const ERRORI: Record<string, string> = {
  autore: "Seleziona un nominativo dalla rubrica per l'autore della comunicazione ufficiale.",
};

// Questa pagina è solo il modulo di creazione/modifica (aperto con ?edit=<id>
// o ?nuovo=1, vedi inFormMode sotto): l'elenco dei moduli — sia per
// compilarli sia, con la matita, per modificarli — vive interamente su
// /moduli (vedi (site)/moduli/page.tsx, che include anche le proprie bozze
// non ancora pubblicate). Prima c'era un secondo elenco qui, quasi identico a
// quello del sito: unica vera differenza i pulsanti Modifica/Elimina, che ora
// compaiono direttamente su /moduli per chi ha il permesso.
export default async function AdminModuli({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string; nuovo?: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.ruolo === "admin";
  const { edit, error, nuovo } = await searchParams;
  const inFormMode = Boolean(edit) || nuovo === "1" || Boolean(error);

  const uffici = await listUffici();
  // Cascata: gli uffici "propri" di un editor sono quelli assegnati più tutti
  // i discendenti (assegnato a un Settore => vale anche per i suoi Uffici).
  const ufficiPropri = espandiConDiscendenti(user.uffici, uffici);
  const ufficiSelezionabili = isAdmin
    ? uffici
    : uffici.filter((u) => ufficiPropri.includes(u.id));

  if ((isAdmin || ufficiSelezionabili.length > 0) && !inFormMode) {
    redirect("/moduli");
  }

  const contatti = await getContatti();
  const candidato = edit ? await getModulo(edit) : null;
  const inModifica = candidato && canManageModuloItem(user, candidato, uffici) ? candidato : null;
  const puoPubblicareNotizia = canEdit(user, "ufficiale");

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>Moduli</h1>
            <p>Form digitali da compilare online, divisi per ufficio.</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {inModifica && (
              <Link href="/admin/moduli?nuovo=1" className="btn btn--ghost btn--sm">
                + Nuovo modulo
              </Link>
            )}
            <Link href="/moduli" className="btn btn--ghost btn--sm">
              ← Torna a Moduli
            </Link>
          </div>
        </div>
      </header>

      {error && <div className="alert">{ERRORI[error] ?? "Controlla i dati inseriti e riprova."}</div>}

      {!isAdmin && ufficiSelezionabili.length === 0 ? (
        <div className="card empty">
          Non hai nessun ufficio assegnato: contatta un amministratore per poter creare moduli.
        </div>
      ) : (
        <ModuloEditor
          key={inModifica?.id ?? "new"}
          modulo={inModifica}
          uffici={ufficiSelezionabili}
          contatti={contatti}
          puoPubblicareNotizia={puoPubblicareNotizia}
        />
      )}
    </section>
  );
}
